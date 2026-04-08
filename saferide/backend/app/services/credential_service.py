"""Business rules and persistence for verifiable credential issuance."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models.credential import Credential
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.services.inji_certify_service import InjiCertifyConfigError, InjiCertifyService

logger = logging.getLogger(__name__)

CREDENTIAL_TYPE_OPERATOR = "OPERATOR"
CREDENTIAL_TYPE_VEHICLE_BINDING = "VEHICLE_BINDING"


class CredentialIssuanceError(Exception):
    """Maps to HTTP errors from the credentials API layer."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def can_issue_operator_credential(operator: Operator) -> tuple[bool, str]:
    if operator.esignet_verified_at is None:
        return False, "Operator must be verified with eSignet (esignet_verified_at is set)"
    if operator.status not in ("APPROVED", "ACTIVE"):
        return (
            False,
            "Operator status must be APPROVED or ACTIVE before issuing credentials "
            f"(current: {operator.status})",
        )
    return True, ""


def binding_is_effective(binding: OperatorVehicleBinding, now: datetime | None = None) -> bool:
    now = now or _now_utc()
    if not binding.is_active:
        return False
    if binding.valid_from is not None and now < binding.valid_from:
        return False
    if binding.valid_until is not None and now > binding.valid_until:
        return False
    return True


def save_credential_record(
    session: Session,
    *,
    operator_id: UUID,
    vehicle_id: UUID | None,
    credential_type: str,
    issuer: str,
    template_name: str | None,
    normalized: dict,
    status: str = "ISSUED",
) -> Credential:
    """Persist a credential row from normalized Inji response data."""
    cred = Credential(
        operator_id=operator_id,
        vehicle_id=vehicle_id,
        credential_type=credential_type,
        issuer=issuer,
        external_credential_id=normalized.get("external_credential_id"),
        template_name=template_name,
        status=status,
        issued_at=normalized.get("issued_at"),
        expires_at=normalized.get("expires_at"),
        raw_reference=normalized.get("raw_reference"),
        metadata_json=normalized.get("metadata"),
    )
    session.add(cred)
    session.commit()
    session.refresh(cred)
    logger.info(
        "credential saved id=%s type=%s operator_id=%s status=%s",
        cred.id,
        credential_type,
        operator_id,
        status,
    )
    return cred


async def issue_operator_credential(
    session: Session,
    operator_id: UUID,
    settings: Settings,
    *,
    access_token: str | None = None,
) -> Credential:
    if not settings.inji_certify_enable:
        raise CredentialIssuanceError(
            "Inji Certify issuance is disabled (set INJI_CERTIFY_ENABLE=true)",
            status_code=503,
        )
    operator = session.get(Operator, operator_id)
    if operator is None:
        raise CredentialIssuanceError("Operator not found", status_code=404)

    ok, reason = can_issue_operator_credential(operator)
    if not ok:
        logger.info(
            "credential.issue_operator: skipped operator_id=%s reason=%s status=%s esignet_verified=%s",
            operator_id,
            reason,
            operator.status,
            operator.esignet_verified_at is not None,
        )
        raise CredentialIssuanceError(reason, status_code=409)

    # Fall back to the stored eSignet token when no token is passed explicitly
    if access_token is None and operator.esignet_last_access_token:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if operator.esignet_token_expires_at is None or operator.esignet_token_expires_at > now:
            access_token = operator.esignet_last_access_token
            logger.info("credential.issue_operator: using stored esignet token operator_id=%s", operator_id)
        else:
            logger.warning(
                "credential.issue_operator: stored esignet token expired operator_id=%s expired_at=%s",
                operator_id,
                operator.esignet_token_expires_at,
            )

    logger.info(
        "credential.issue_operator: starting issuance operator_id=%s name=%r phone=%s certify_url=%s",
        operator_id,
        operator.full_name,
        operator.phone,
        settings.inji_certify_base_url,
    )
    inji = InjiCertifyService(settings)
    try:
        raw = await inji.issue_operator_credential(operator, access_token=access_token)
    except InjiCertifyConfigError as exc:
        logger.error("credential.issue_operator: config error operator_id=%s error=%s", operator_id, exc)
        raise CredentialIssuanceError(str(exc), status_code=503) from exc
    except httpx.HTTPStatusError as exc:
        logger.error(
            "credential.issue_operator: HTTP %s from Certify operator_id=%s body=%s",
            exc.response.status_code,
            operator_id,
            exc.response.text[:500],
        )
        raise CredentialIssuanceError(
            f"Inji Certify operator issuance failed: {exc.response.text[:500]}",
            status_code=502,
        ) from exc
    except httpx.RequestError as exc:
        logger.error("credential.issue_operator: network error operator_id=%s error=%s", operator_id, exc)
        raise CredentialIssuanceError(
            f"Could not reach Inji Certify: {exc}",
            status_code=502,
        ) from exc
    except ValueError as exc:
        logger.error("credential.issue_operator: bad response operator_id=%s error=%s", operator_id, exc)
        raise CredentialIssuanceError(str(exc), status_code=502) from exc

    normalized = InjiCertifyService.normalize_issue_response(raw)
    logger.info(
        "credential.issue_operator: Certify responded ok operator_id=%s external_id=%s template=%s issued_at=%s",
        operator_id,
        normalized.get("external_credential_id"),
        settings.inji_certify_operator_credential_template,
        normalized.get("issued_at"),
    )
    return save_credential_record(
        session,
        operator_id=operator.id,
        vehicle_id=None,
        credential_type=CREDENTIAL_TYPE_OPERATOR,
        issuer=settings.inji_certify_issuer_id,
        template_name=settings.inji_certify_operator_credential_template,
        normalized=normalized,
        status="ISSUED",
    )


async def issue_vehicle_binding_credential(
    session: Session,
    operator_id: UUID,
    vehicle_id: UUID,
    settings: Settings,
    *,
    access_token: str | None = None,
) -> Credential:
    if not settings.inji_certify_enable:
        raise CredentialIssuanceError(
            "Inji Certify issuance is disabled (set INJI_CERTIFY_ENABLE=true)",
            status_code=503,
        )
    operator = session.get(Operator, operator_id)
    if operator is None:
        raise CredentialIssuanceError("Operator not found", status_code=404)
    vehicle = session.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise CredentialIssuanceError("Vehicle not found", status_code=404)

    ok, reason = can_issue_operator_credential(operator)
    if not ok:
        raise CredentialIssuanceError(reason, status_code=409)

    stmt = (
        select(OperatorVehicleBinding)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.vehicle_id == vehicle_id)
    )
    binding = session.exec(stmt).first()
    if binding is None:
        raise CredentialIssuanceError(
            "No operator–vehicle binding exists for this pair",
            status_code=404,
        )
    if not binding_is_effective(binding):
        raise CredentialIssuanceError(
            "Binding is inactive or outside its validity window",
            status_code=409,
        )

    inji = InjiCertifyService(settings)
    try:
        raw = await inji.issue_vehicle_binding_credential(
            operator, vehicle, binding, access_token=access_token
        )
    except InjiCertifyConfigError as exc:
        raise CredentialIssuanceError(str(exc), status_code=503) from exc
    except httpx.HTTPStatusError as exc:
        raise CredentialIssuanceError(
            f"Inji Certify vehicle issuance failed: {exc.response.text[:500]}",
            status_code=502,
        ) from exc
    except httpx.RequestError as exc:
        raise CredentialIssuanceError(
            f"Could not reach Inji Certify: {exc}",
            status_code=502,
        ) from exc
    except ValueError as exc:
        raise CredentialIssuanceError(str(exc), status_code=502) from exc

    normalized = InjiCertifyService.normalize_issue_response(raw)
    return save_credential_record(
        session,
        operator_id=operator.id,
        vehicle_id=vehicle.id,
        credential_type=CREDENTIAL_TYPE_VEHICLE_BINDING,
        issuer=settings.inji_certify_issuer_id,
        template_name=settings.inji_certify_vehicle_credential_template,
        normalized=normalized,
        status="ISSUED",
    )


def get_credential(session: Session, credential_id: UUID) -> Credential | None:
    return session.get(Credential, credential_id)
