"""Operator read + governance (trust status, vehicle bindings)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.auth import (
    get_settings_dep,
    get_current_operator,
    require_governance_operator,
    require_governance_read_operator,
)
from app.core.config import Settings
from app.core.rbac import normalize_operator_role
from app.core.security import driver_default_password, hash_password
from app.db.models.corporate_body import CorporateBody
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.ride_event import RideEvent
from app.db.models.vehicle import Vehicle
from app.db.session import get_session
from app.schemas.binding import (
    OperatorVehicleBindingCreate,
    OperatorVehicleBindingListItem,
    OperatorVehicleBindingRead,
)
from app.schemas.auth import AuthStartResponse
from app.schemas.operator import (
    OperatorGovernanceUpdate,
    OperatorListItem,
    OperatorRead,
    OperatorStatusUpdate,
)
from app.services.esignet_debug_store import esignet_debug_store
from app.services.esignet_service import ESignetService, MissingConfigError
from app.services.credential_service import CredentialIssuanceError, can_issue_operator_credential, issue_operator_credential
from app.services.governance_service import GovernanceError, list_operators_with_vehicle_hint, set_operator_trust_status
from app.services.oauth_state_store import oauth_state_store
from app.services.pkce_service import build_s256_challenge, generate_code_verifier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operators", tags=["operators"])


def _require_governance_same_corporate_or_platform(actor: Operator, target: Operator) -> None:
    """Officers may only change operators in their corporate body; platform roles may change any."""
    ar = normalize_operator_role(actor.role)
    if ar in ("admin", "system_admin"):
        return
    if ar == "officer":
        if actor.corporate_body_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Officer account must be attached to a corporate body",
            )
        if target.corporate_body_id != actor.corporate_body_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Not allowed outside your corporate body",
            )
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")


def _require_officer_fellow_officer_or_platform(actor: Operator, target: Operator) -> None:
    """Profile edits from the portal: officers only touch fellow officers in the same body."""
    ar = normalize_operator_role(actor.role)
    if ar in ("admin", "system_admin"):
        return
    if ar == "officer":
        if actor.corporate_body_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Officer account must be attached to a corporate body",
            )
        if target.corporate_body_id != actor.corporate_body_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Not allowed outside your corporate body",
            )
        if normalize_operator_role(target.role) != "officer":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Not allowed to update this account type",
            )
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class OperatorEnrollBody(BaseModel):
    email: str | None = None
    password: str | None = Field(default=None, max_length=128)
    full_name: str | None = None
    phone: str
    role: str = "driver"


class ESignetOnboardingCompleteBody(BaseModel):
    code: str
    nonce: str


class ESignetDebugRead(BaseModel):
    operator_id: UUID
    claims: dict
    userinfo: dict | str | None
    created_at: int


def _require_self_or_governance(
    operator_id: UUID,
    current: Operator,
) -> None:
    if current.id == operator_id:
        return
    if normalize_operator_role(current.role) in ("monitor", "support", "officer", "admin", "system_admin"):
        return
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        detail="Not allowed to view this operator",
    )


@router.get("", response_model=list[OperatorListItem])
def list_operators(
    actor: Annotated[Operator, Depends(require_governance_read_operator)],
    session: Annotated[Session, Depends(get_session)],
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = 200,
) -> list[OperatorListItem]:
    actor_role = normalize_operator_role(actor.role)
    corp_scope = actor.corporate_body_id if actor_role == "officer" else None
    rows = list_operators_with_vehicle_hint(session, status=status_filter, q=q, limit=limit, corporate_body_id=corp_scope)
    return [
        OperatorListItem(
            operator=OperatorRead.model_validate(op),
            primary_vehicle_plate=plate,
        )
        for op, plate in rows
    ]


@router.get("/{operator_id}/vehicle-bindings", response_model=list[OperatorVehicleBindingListItem])
def list_vehicle_bindings(
    operator_id: UUID,
    current: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> list[OperatorVehicleBindingListItem]:
    _require_self_or_governance(operator_id, current)
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    current_role = normalize_operator_role(current.role)
    if current_role == "officer" and current.corporate_body_id != op.corporate_body_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed outside your corporate body")
    stmt = (
        select(OperatorVehicleBinding, Vehicle)
        .join(Vehicle, OperatorVehicleBinding.vehicle_id == Vehicle.id)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .order_by(OperatorVehicleBinding.created_at.desc())
    )
    out: list[OperatorVehicleBindingListItem] = []
    for bind, veh in session.exec(stmt).all():
        corp_name: str | None = None
        if veh.corporate_body_id is not None:
            cb = session.get(CorporateBody, veh.corporate_body_id)
            if cb is not None:
                corp_name = cb.name
        out.append(
            OperatorVehicleBindingListItem(
                binding=OperatorVehicleBindingRead.model_validate(bind),
                plate=veh.external_ref or veh.display_name,
                vehicle_display_name=veh.display_name,
                vehicle_type=veh.vehicle_type,
                make_model=veh.make_model,
                color=veh.color,
                corporate_body_name=corp_name,
                vehicle_updated_at=veh.updated_at,
            )
        )
    return out


@router.get("/{operator_id}/ride-events")
def list_operator_ride_events(
    operator_id: UUID,
    current: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
    limit: int = 100,
) -> list[dict]:
    """Recent trust / consent events for this operator (driver scan history)."""
    _require_self_or_governance(operator_id, current)
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    current_role = normalize_operator_role(current.role)
    if current_role == "officer" and current.corporate_body_id != op.corporate_body_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed outside your corporate body")
    cap = min(max(limit, 1), 500)
    stmt = (
        select(RideEvent)
        .where(RideEvent.operator_id == operator_id)
        .order_by(RideEvent.recorded_at.desc())
        .limit(cap)
    )
    rows = list(session.exec(stmt).all())
    return [
        {
            "id": str(r.id),
            "operator_id": str(r.operator_id),
            "verify_short_code": r.verify_short_code,
            "channel": r.channel,
            "passenger_msisdn": r.passenger_msisdn,
            "event_type": r.event_type,
            "consent_request_id": str(r.consent_request_id) if r.consent_request_id else None,
            "recorded_at": r.recorded_at.isoformat(),
        }
        for r in rows
    ]


@router.post(
    "/{operator_id}/vehicle-bindings",
    response_model=OperatorVehicleBindingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_vehicle_binding(
    operator_id: UUID,
    body: OperatorVehicleBindingCreate,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorVehicleBindingRead:
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    veh = session.get(Vehicle, body.vehicle_id)
    if veh is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    stmt = (
        select(OperatorVehicleBinding)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.vehicle_id == body.vehicle_id)
    )
    existing = session.exec(stmt).first()
    if existing:
        existing.is_active = True
        existing.updated_at = _utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return OperatorVehicleBindingRead.model_validate(existing)
    bind = OperatorVehicleBinding(
        operator_id=operator_id,
        vehicle_id=body.vehicle_id,
        is_active=True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(bind)
    session.commit()
    session.refresh(bind)
    logger.info(
        "operators.bind operator_id=%s vehicle_id=%s binding_id=%s",
        operator_id,
        body.vehicle_id,
        bind.id,
    )
    return OperatorVehicleBindingRead.model_validate(bind)


@router.patch("/{operator_id}/status", response_model=OperatorRead)
async def patch_operator_status(
    operator_id: UUID,
    body: OperatorStatusUpdate,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> OperatorRead:
    target = session.get(Operator, operator_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    _require_governance_same_corporate_or_platform(actor, target)
    try:
        op = set_operator_trust_status(session, operator_id, body.status)
    except GovernanceError as exc:
        raise HTTPException(exc.status_code, detail=exc.message) from exc

    # Fire-and-forget VC issuance when operator becomes APPROVED/ACTIVE
    if settings.inji_certify_enable and body.status.upper() in ("APPROVED", "ACTIVE"):
        ok, _ = can_issue_operator_credential(op)
        if ok:
            import asyncio
            async def _issue_vc() -> None:
                try:
                    await issue_operator_credential(session, op.id, settings)
                    logger.info("operators.patch_status: VC issued operator_id=%s", op.id)
                except CredentialIssuanceError as exc:
                    logger.warning("operators.patch_status: VC skipped operator_id=%s reason=%s", op.id, exc.message)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("operators.patch_status: VC error operator_id=%s error=%s", op.id, exc)
            asyncio.ensure_future(_issue_vc())

    return OperatorRead.model_validate(op)


@router.patch("/{operator_id}", response_model=OperatorRead)
def patch_operator_profile(
    operator_id: UUID,
    body: OperatorGovernanceUpdate,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    _require_officer_fellow_officer_or_platform(actor, op)
    if body.full_name is not None:
        op.full_name = (body.full_name or "").strip() or None
    if body.email is not None:
        email = (body.email or "").strip().lower() or None
        if email:
            existing = session.exec(select(Operator).where(Operator.email == email)).first()
            if existing is not None and existing.id != op.id:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already exists")
        op.email = email
    op.updated_at = _utcnow()
    session.add(op)
    session.commit()
    session.refresh(op)
    logger.info("operators.patch_profile operator_id=%s", operator_id)
    return OperatorRead.model_validate(op)


@router.get("/{operator_id}", response_model=OperatorRead)
def get_operator(
    operator_id: UUID,
    current: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    _require_self_or_governance(operator_id, current)
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    current_role = normalize_operator_role(current.role)
    if current_role == "officer" and current.corporate_body_id != op.corporate_body_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed outside your corporate body")
    logger.debug("operators.get operator_id=%s", operator_id)
    return OperatorRead.model_validate(op)


@router.get("/{operator_id}/esignet-debug", response_model=ESignetDebugRead)
def get_operator_esignet_debug(
    operator_id: UUID,
    actor: Annotated[Operator, Depends(require_governance_read_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> ESignetDebugRead:
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    actor_role = normalize_operator_role(actor.role)
    if actor_role == "officer" and actor.corporate_body_id != op.corporate_body_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed outside your corporate body")
    row = esignet_debug_store.get(operator_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No recent eSignet debug payload")
    return ESignetDebugRead(
        operator_id=row.operator_id,
        claims=row.claims,
        userinfo=row.userinfo,
        created_at=row.created_at,
    )


@router.post("/enroll", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def enroll_operator_or_rider(
    body: OperatorEnrollBody,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    """
    Corporate officer onboarding for rider identities.
    Allowed role here: passenger.
    """
    actor_role = normalize_operator_role(actor.role)
    if actor_role != "officer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only officers can enroll riders")
    if actor.corporate_body_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Officer account must be attached to a corporate body")
    role = normalize_operator_role(body.role)
    if role != "passenger":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only rider/passenger can be enrolled here")
    email = (body.email or "").strip().lower() or None
    if email:
        existing = session.exec(select(Operator).where(Operator.email == email)).first()
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already exists")
    phone = (body.phone or "").strip().replace(" ", "") or None
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Phone is required")
    if phone:
        exists_phone = session.exec(select(Operator).where(Operator.phone == phone)).first()
        if exists_phone is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Phone already exists")
    initial_password = (body.password or "").strip() or (
        driver_default_password(phone) if role == "driver" else phone
    )
    now = _utcnow()
    corp_scope = actor.corporate_body_id
    op = Operator(
        external_subject_id=f"association:{role}:{email or phone}",
        full_name=(body.full_name or "").strip() or None,
        email=email,
        phone=phone,
        auth_provider="association",
        # Rider onboarding must complete eSignet before becoming active.
        status="PENDING",
        role=role,
        corporate_body_id=corp_scope,
        password_hash=hash_password(initial_password),
        created_at=now,
        updated_at=now,
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return OperatorRead.model_validate(op)


@router.post("/onboarding/esignet/start", response_model=AuthStartResponse)
def start_officer_esignet_onboarding(
    actor: Annotated[Operator, Depends(require_governance_operator)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> AuthStartResponse:
    actor_role = normalize_operator_role(actor.role)
    if actor_role != "officer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only officers can start rider onboarding via eSignet")
    if actor.corporate_body_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Officer account must be attached to a corporate body")
    esignet = ESignetService(settings)
    try:
        code_verifier = generate_code_verifier()
        code_challenge = build_s256_challenge(code_verifier)
        nonce = generate_code_verifier()[:32]
        txn = oauth_state_store.create(
            code_verifier=code_verifier,
            nonce=nonce,
            next_path="/portal/operators",
            onboarding_corporate_body_id=actor.corporate_body_id,
        )
        url = esignet.get_authorization_url(state=txn.state, code_challenge=code_challenge, nonce=nonce)
    except MissingConfigError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return AuthStartResponse(authorization_url=url, state=txn.state, expires_in=600)


@router.post("/onboarding/esignet/complete", response_model=OperatorRead)
async def complete_officer_esignet_onboarding(
    body: ESignetOnboardingCompleteBody,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> OperatorRead:
    actor_role = normalize_operator_role(actor.role)
    if actor_role != "officer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only officers can complete rider onboarding via eSignet")
    if actor.corporate_body_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Officer account must be attached to a corporate body")

    esignet = ESignetService(settings)
    try:
        tokens = await esignet.exchange_code_for_token(code=body.code, code_verifier="")
        id_claims = await esignet.verify_id_token(tokens.id_token, nonce=body.nonce)
        claims: dict = dict(id_claims)
        try:
            userinfo_raw = await esignet.fetch_userinfo(tokens.access_token)
            userinfo_claims = esignet.verify_and_parse_userinfo(userinfo_raw)
            claims.update({k: v for k, v in userinfo_claims.items() if v not in (None, "")})
        except httpx.HTTPStatusError:
            pass
        normalized = esignet.normalize_claims(claims)
    except MissingConfigError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except TokenExchangeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Could not reach eSignet token endpoint: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    phone = (normalized.get("phone") or "").strip().replace(" ", "")
    if not phone:
        logger.warning(
            "operators.esignet.complete: missing phone in normalized claims for subject=%s (available keys=%s)",
            normalized.get("external_subject_id"),
            sorted(k for k, v in normalized.items() if v not in (None, "")),
        )

    if phone:
        existing_by_phone = session.exec(select(Operator).where(Operator.phone == phone)).first()
        if existing_by_phone is not None and existing_by_phone.external_subject_id != normalized["external_subject_id"]:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Phone already exists")

    existing = session.exec(select(Operator).where(Operator.external_subject_id == normalized["external_subject_id"])).first()
    now = _utcnow()
    if existing is not None:
        if normalize_operator_role(existing.role) not in ("passenger", "driver"):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="eSignet identity is already linked to a non-rider account")
        # Guard against registering the same driver under a different corporate body.
        if existing.corporate_body_id and existing.corporate_body_id != actor.corporate_body_id:
            logger.warning(
                "operators.esignet.complete: driver already belongs to a different corporate body "
                "operator_id=%s existing_corp=%s requesting_corp=%s",
                existing.id,
                existing.corporate_body_id,
                actor.corporate_body_id,
            )
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="This driver is already registered under a different transport association.",
            )
        if existing.corporate_body_id == actor.corporate_body_id:
            logger.info(
                "operators.esignet.complete: driver already registered in this corporate body, refreshing details "
                "operator_id=%s name=%r phone=%s corp=%s",
                existing.id,
                existing.full_name,
                existing.phone,
                existing.corporate_body_id,
            )
        existing.full_name = normalized.get("full_name") or existing.full_name
        existing.email = normalized.get("email") or existing.email
        if phone:
            existing.phone = phone
        existing.photo_ref = normalized.get("photo_ref") or existing.photo_ref
        existing.individual_id = normalized.get("individual_id") or existing.individual_id
        existing.gender = normalized.get("gender") or existing.gender
        existing.birthdate = normalized.get("birthdate") or existing.birthdate
        existing.registration_type = normalized.get("registration_type") or existing.registration_type
        existing.acr = normalized.get("acr") or existing.acr
        existing.auth_provider = "esignet"
        existing.esignet_verified_at = existing.esignet_verified_at or now
        existing.status = "PENDING"
        existing.role = "driver"
        existing.corporate_body_id = existing.corporate_body_id or actor.corporate_body_id
        existing.updated_at = now
        if phone and not existing.password_hash:
            existing.password_hash = hash_password(driver_default_password(phone))
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return OperatorRead.model_validate(existing)

    op = Operator(
        external_subject_id=normalized["external_subject_id"],
        full_name=normalized.get("full_name"),
        email=normalized.get("email"),
        phone=phone or None,
        photo_ref=normalized.get("photo_ref"),
        individual_id=normalized.get("individual_id"),
        gender=normalized.get("gender"),
        birthdate=normalized.get("birthdate"),
        registration_type=normalized.get("registration_type"),
        acr=normalized.get("acr"),
        auth_provider="esignet",
        esignet_verified_at=now,
        status="PENDING",
        role="driver",
        corporate_body_id=actor.corporate_body_id,
        password_hash=hash_password(driver_default_password(phone)) if phone else None,
        created_at=now,
        updated_at=now,
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return OperatorRead.model_validate(op)


@router.post("/{operator_id}/onboarding/esignet/start", response_model=AuthStartResponse)
def start_passenger_esignet_onboarding(
    operator_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> AuthStartResponse:
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    role = normalize_operator_role(op.role)
    if role != "passenger":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="eSignet onboarding start is only for passengers")
    if op.esignet_verified_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Passenger already eSignet-verified")
    esignet = ESignetService(settings)
    try:
        code_verifier = generate_code_verifier()
        code_challenge = build_s256_challenge(code_verifier)
        nonce = generate_code_verifier()[:32]
        txn = oauth_state_store.create(
            code_verifier=code_verifier,
            nonce=nonce,
            next_path="/",
            onboarding_operator_id=operator_id,
        )
        url = esignet.get_authorization_url(state=txn.state, code_challenge=code_challenge, nonce=nonce)
    except MissingConfigError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return AuthStartResponse(authorization_url=url, state=txn.state, expires_in=600)
