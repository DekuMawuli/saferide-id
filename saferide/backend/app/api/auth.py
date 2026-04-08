"""Browser OAuth with eSignet and SafeRide-issued API tokens."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.rbac import (
    normalize_operator_role,
    resolve_post_login_path,
    sanitize_next_path,
)
from app.core.security import (
    create_operator_access_token,
    create_operator_refresh_token,
    decode_operator_access_token,
    driver_default_password,
    hash_password,
    verify_password,
)
from app.db.models.consent_request import ConsentRequest
from app.db.models.operator import Operator
from app.db.session import get_session
from app.schemas.auth import (
    AdminBootstrapBody,
    AdminCreateBody,
    AdminLoginBody,
    RiderLoginBody,
    AuthMeResponse,
    AuthStartResponse,
    ESignetCallbackResponse,
)
from app.schemas.operator import OperatorRead
from app.schemas.public_consent import ConsentRequestItem, ConsentRespondBody
from app.services.esignet_service import (
    IdTokenVerificationError,
    MissingConfigError,
    ESignetService,
    TokenExchangeError,
)
from app.services.esignet_debug_store import esignet_debug_store
from app.services.oauth_state_store import oauth_state_store
from app.services.pkce_service import build_s256_challenge, generate_code_verifier
from app.services.consent_service import list_pending_for_operator, respond_consent_request
from app.services.operator_service import upsert_operator_from_claims
from app.services.credential_service import (
    CredentialIssuanceError,
    can_issue_operator_credential,
    issue_operator_credential_detached,
)
from app.services.mock_identity_service import hydrate_operator_from_mock_identity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)
PLATFORM_ADMIN_ROLES = {"monitor", "support", "admin", "system_admin"}
OPERATOR_ROLES = {"officer"}


def get_settings_dep() -> Settings:
    return get_settings()


def get_esignet_service(settings: Annotated[Settings, Depends(get_settings_dep)]) -> ESignetService:
    return ESignetService(settings)


def get_optional_operator(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> Operator | None:
    """Resolve operator from `Authorization: Bearer` SafeRide access token, if present."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        operator_id = decode_operator_access_token(credentials.credentials, settings)
    except InvalidTokenError:
        logger.debug("auth: Bearer token invalid or expired")
        return None
    return session.get(Operator, operator_id)


def get_current_operator(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> Operator:
    """Require a valid SafeRide Bearer token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        operator_id = decode_operator_access_token(credentials.credentials, settings)
    except InvalidTokenError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Operator not found",
        )
    return op


def require_governance_operator(
    operator: Annotated[Operator, Depends(get_current_operator)],
) -> Operator:
    """Officer/admin/system_admin write access (SACCO / authority tooling)."""
    r = normalize_operator_role(operator.role)
    if r not in ("officer", "admin", "system_admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Officer, admin, or system_admin role required",
        )
    return operator


def require_governance_read_operator(
    operator: Annotated[Operator, Depends(get_current_operator)],
) -> Operator:
    """Read-only governance access (monitor/support/officer/admin/system_admin)."""
    r = normalize_operator_role(operator.role)
    if r not in ("monitor", "support", "officer", "admin", "system_admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Governance read role required",
        )
    return operator


def require_system_admin_operator(
    operator: Annotated[Operator, Depends(get_current_operator)],
) -> Operator:
    r = normalize_operator_role(operator.role)
    if r != "system_admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="System admin role required",
        )
    return operator


@router.get("/esignet/login", response_model=None)
async def esignet_login(
    settings: Annotated[Settings, Depends(get_settings_dep)],
    esignet: Annotated[ESignetService, Depends(get_esignet_service)],
    next: str | None = Query(
        default=None,
        description="Optional post-login path on the frontend (must be allowlisted)",
    ),
    response_mode: str | None = Query(default=None, description="Use `json` to return auth URL payload"),
) -> RedirectResponse | JSONResponse:
    """
    Start OIDC authorization code flow: redirect browser to eSignet.

    Generates state + PKCE verifier/challenge and stores short-lived auth transaction in-memory.
    """
    logger.info("auth.esignet.login: starting OIDC redirect")
    allow = settings.oauth_next_paths_allowlist_set()
    next_path = sanitize_next_path(next, allow)
    if next and next_path is None:
        logger.warning("auth.esignet.login: rejected disallowed next=%s", next[:80])
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Query `next` is not an allowlisted path",
        )
    try:
        code_verifier = generate_code_verifier()
        code_challenge = build_s256_challenge(code_verifier)
        nonce = secrets.token_urlsafe(24)
        txn = oauth_state_store.create(code_verifier=code_verifier, nonce=nonce, next_path=next_path)
        url = esignet.get_authorization_url(state=txn.state, code_challenge=code_challenge, nonce=nonce)
    except MissingConfigError as exc:
        logger.error("auth.esignet.login: eSignet misconfigured: %s", exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    logger.debug("auth.esignet.login: redirect to authorize endpoint (state issued)")
    if (response_mode or "").lower() == "json":
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=AuthStartResponse(authorization_url=url, state=txn.state, expires_in=1800).model_dump(),
        )
    logger.info("auth.esignet.login: 302 to IdP")
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/esignet/callback", response_model=None)
async def esignet_callback(
    settings: Annotated[Settings, Depends(get_settings_dep)],
    session: Annotated[Session, Depends(get_session)],
    esignet: Annotated[ESignetService, Depends(get_esignet_service)],
    code: str | None = None,
    state: str | None = None,
    iss: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    response_mode: str | None = Query(
        default=None,
        description="Use `json` to return JSON instead of redirecting the browser to the SPA",
    ),
) -> RedirectResponse | JSONResponse:
    """
    OAuth redirect target: exchange code, fetch userinfo, upsert operator.

    Default: **302** to `FRONTEND_APP_URL` + RBAC home (or allowlisted `next`) with `access_token` in the **URL hash**.

    `?response_mode=json` keeps the previous JSON body (e.g. curl, API clients).
    """
    logger.info("auth.esignet.callback: received redirect from IdP")
    if error:
        logger.warning(
            "auth.esignet.callback: IdP error error=%s description=%s",
            error,
            (error_description or "")[:200],
        )
        if (response_mode or "").lower() == "json":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": error,
                    "error_description": error_description or "",
                },
            )
        # Redirect back to the frontend with the error so the SPA can display it.
        err_desc = error_description or error
        txn_err = oauth_state_store.consume(state) if state else None
        base = settings.frontend_app_url.rstrip("/")
        if txn_err is not None and (
            txn_err.onboarding_corporate_body_id is not None
            or txn_err.onboarding_operator_id is not None
        ):
            qs = urlencode({"error_description": err_desc})
            return RedirectResponse(
                url=f"{base}/portal/operators?{qs}",
                status_code=status.HTTP_302_FOUND,
            )
        qs = urlencode({"error_description": err_desc})
        return RedirectResponse(
            url=f"{base}/login/driver?{qs}",
            status_code=status.HTTP_302_FOUND,
        )
    if not code or not state:
        logger.warning("auth.esignet.callback: missing code or state")
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Missing `code` or `state` query parameters",
        )

    if iss and iss.rstrip("/") != settings.esignet_issuer.rstrip("/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Issuer mismatch in callback")
    txn = oauth_state_store.consume(state)
    if txn is None:
        logger.warning("auth.esignet.callback: invalid or expired state=%s", state[:12] if state else "")
        if (response_mode or "").lower() == "json":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired state; restart login from /auth/esignet/login",
            )
        base = settings.frontend_app_url.rstrip("/")
        return RedirectResponse(
            url=f"{base}/login?error=session_expired",
            status_code=status.HTTP_302_FOUND,
        )

    logger.debug("auth.esignet.callback: exchanging authorization code for tokens")
    try:
        tokens = await esignet.exchange_code_for_token(code=code, code_verifier=txn.code_verifier)
    except TokenExchangeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        logger.exception("eSignet token network error")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach eSignet token endpoint: {exc}",
        ) from exc

    try:
        id_claims = await esignet.verify_id_token(tokens.id_token, nonce=txn.nonce)
    except IdTokenVerificationError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    logger.debug("auth.esignet.callback: fetching userinfo")
    claims: dict = dict(id_claims)
    userinfo_raw: dict | str | None = None
    try:
        userinfo_raw = await esignet.fetch_userinfo(tokens.access_token)
        userinfo_claims = await esignet.verify_and_parse_userinfo(userinfo_raw)
        claims.update({k: v for k, v in userinfo_claims.items() if v not in (None, "")})
    except httpx.HTTPStatusError as exc:
        logger.warning("auth.esignet.callback: userinfo failed; continuing with id_token claims only: %s", exc)
    except ValueError:
        sample = str(userinfo_raw)[:1200] if "userinfo_raw" in locals() else "<missing>"
        logger.warning(
            "auth.esignet.callback: userinfo claims parse failed; continuing with id_token claims only; raw_userinfo_sample=%s",
            sample,
        )
    try:
        normalized = esignet.normalize_claims(claims)
    except ValueError as exc:
        logger.warning("auth.esignet.callback: userinfo/claims error: %s", exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    logger.debug(
        "auth.esignet.callback: normalized subject external_subject_id=%s",
        normalized.get("external_subject_id"),
    )
    if txn.onboarding_operator_id is not None:
        operator = session.get(Operator, txn.onboarding_operator_id)
        if operator is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Onboarding operator not found")
        if normalize_operator_role(operator.role) != "passenger":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Onboarding target must be passenger")
        existing = session.exec(
            select(Operator).where(Operator.external_subject_id == normalized["external_subject_id"])
        ).first()
        if existing is not None and existing.id != operator.id:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="eSignet identity already linked to another account")
        operator.external_subject_id = normalized["external_subject_id"]
        operator.full_name = normalized.get("full_name") or operator.full_name
        operator.email = normalized.get("email") or operator.email
        operator.phone = normalized.get("phone") or operator.phone
        operator.photo_ref = normalized.get("photo_ref") or operator.photo_ref
        operator.individual_id = normalized.get("individual_id") or operator.individual_id
        operator.gender = normalized.get("gender") or operator.gender
        operator.birthdate = normalized.get("birthdate") or operator.birthdate
        operator.registration_type = normalized.get("registration_type") or operator.registration_type
        operator.acr = normalized.get("acr") or operator.acr
        operator.auth_provider = "esignet"
        operator.esignet_verified_at = operator.esignet_verified_at or datetime.now(timezone.utc).replace(tzinfo=None)
        # Passenger becomes active only after successful eSignet verification.
        operator.status = "ACTIVE"
        session.add(operator)
        session.commit()
        session.refresh(operator)
    elif txn.onboarding_corporate_body_id is not None:
        phone = (normalized.get("phone") or "").strip().replace(" ", "")
        if not phone:
            logger.warning(
                "auth.esignet.callback: missing phone in normalized claims for subject=%s (available keys=%s)",
                normalized.get("external_subject_id"),
                sorted(k for k, v in normalized.items() if v not in (None, "")),
            )
        if phone:
            existing_by_phone = session.exec(select(Operator).where(Operator.phone == phone)).first()
            if existing_by_phone is not None and existing_by_phone.external_subject_id != normalized["external_subject_id"]:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Phone already exists")
        existing = session.exec(
            select(Operator).where(Operator.external_subject_id == normalized["external_subject_id"])
        ).first()
        if existing is not None:
            if normalize_operator_role(existing.role) not in ("passenger", "driver"):
                raise HTTPException(status.HTTP_409_CONFLICT, detail="eSignet identity is already linked to a non-rider account")
            # Guard: don't let a different corporate body claim an already-registered driver.
            if existing.corporate_body_id and existing.corporate_body_id != txn.onboarding_corporate_body_id:
                logger.warning(
                    "auth.esignet.callback: driver already belongs to a different corporate body "
                    "operator_id=%s existing_corp=%s requesting_corp=%s",
                    existing.id,
                    existing.corporate_body_id,
                    txn.onboarding_corporate_body_id,
                )
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="This driver is already registered under a different transport association.",
                )
            if existing.corporate_body_id == txn.onboarding_corporate_body_id:
                logger.info(
                    "auth.esignet.callback: driver already registered in this corporate body, refreshing details "
                    "operator_id=%s name=%r phone=%s corp=%s",
                    existing.id,
                    existing.full_name,
                    existing.phone,
                    existing.corporate_body_id,
                )
            now = datetime.now(timezone.utc).replace(tzinfo=None)
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
            existing.esignet_verified_at = existing.esignet_verified_at or datetime.now(timezone.utc).replace(tzinfo=None)
            existing.status = "PENDING"
            existing.role = "driver"
            existing.corporate_body_id = existing.corporate_body_id or txn.onboarding_corporate_body_id
            existing.updated_at = now
            if phone and not existing.password_hash:
                existing.password_hash = hash_password(driver_default_password(phone))
            session.add(existing)
            session.commit()
            session.refresh(existing)
            operator = existing
        else:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            operator = Operator(
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
                corporate_body_id=txn.onboarding_corporate_body_id,
                password_hash=hash_password(driver_default_password(phone)) if phone else None,
                created_at=now,
                updated_at=now,
            )
            session.add(operator)
            session.commit()
            session.refresh(operator)
    else:
        operator = upsert_operator_from_claims(session, normalized)
    norm_role = normalize_operator_role(operator.role)
    if operator.role != norm_role:
        operator.role = norm_role
        session.add(operator)
        session.commit()
        session.refresh(operator)

    # Persist the eSignet access_token so admin-triggered VC issuance can use it
    try:
        import jwt as _jwt
        token_payload = _jwt.decode(tokens.access_token, options={"verify_signature": False})
        exp = token_payload.get("exp")
        token_exp = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None) if exp else None
    except Exception:
        token_exp = None
    operator.esignet_last_access_token = tokens.access_token
    operator.esignet_token_expires_at = token_exp
    session.add(operator)
    session.commit()
    session.refresh(operator)

    # Local-dev fallback: some eSignet userinfo payloads omit individual_id even
    # though the identity exists in mock-identity-system. Hydrate it by phone so
    # the operator can receive an Inji credential during the same flow.
    if not (operator.individual_id or "").strip():
        hydrate_operator_from_mock_identity(session, settings, operator)

    esignet_debug_store.set(
        operator.id,
        claims=claims,
        userinfo=userinfo_raw,
    )

    # Attempt VC issuance when Certify is enabled and the operator is ready.
    # This runs fire-and-forget so a Certify error never blocks the login redirect.
    if settings.inji_certify_enable:
        ok, _ = can_issue_operator_credential(operator)
        if ok:
            import asyncio
            async def _issue_vc() -> None:
                try:
                    await issue_operator_credential_detached(
                        operator.id,
                        settings,
                        access_token=tokens.access_token,
                    )
                    logger.info(
                        "auth.esignet.callback: VC issued for operator_id=%s", operator.id
                    )
                except CredentialIssuanceError as exc:
                    logger.warning(
                        "auth.esignet.callback: VC issuance skipped operator_id=%s reason=%s",
                        operator.id,
                        exc.message,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "auth.esignet.callback: VC issuance error operator_id=%s error=%s",
                        operator.id,
                        exc,
                    )
            asyncio.ensure_future(_issue_vc())

    if txn.onboarding_corporate_body_id is not None and (response_mode or "").lower() != "json":
        base = settings.frontend_app_url.rstrip("/")
        detail_path = f"/portal/operators/{operator.id}"
        redirect_url = f"{base}{detail_path}?esignet=1"
        logger.info(
            "auth.esignet.callback: officer onboarding complete operator_id=%s redirect_path=%s esignet_details=%s",
            operator.id,
            detail_path,
            {
                "external_subject_id": normalized.get("external_subject_id"),
                "full_name": normalized.get("full_name"),
                "phone": normalized.get("phone"),
                "email": normalized.get("email"),
                "individual_id": normalized.get("individual_id"),
                "acr": normalized.get("acr"),
            },
        )
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    api_token, ttl = create_operator_access_token(operator.id, settings, role=norm_role)
    refresh_token, refresh_ttl = create_operator_refresh_token(operator.id, settings, role=norm_role)
    allow = settings.oauth_next_paths_allowlist_set()
    rel_path = resolve_post_login_path(norm_role, txn.next_path, allow)
    base = settings.frontend_app_url.rstrip("/")
    fragment = urlencode(
        {
            "access_token": api_token,
            "token_type": "bearer",
            "expires_in": str(ttl),
            "role": norm_role,
        }
    )
    redirect_url = f"{base}{rel_path}#{fragment}"

    logger.info(
        "auth.esignet.callback: success operator_id=%s role=%s redirect_path=%s",
        operator.id,
        norm_role,
        rel_path,
    )

    if (response_mode or "").lower() == "json":
        body = ESignetCallbackResponse(
            operator=OperatorRead.model_validate(operator),
            access_token=api_token,
            refresh_token=refresh_token,
            expires_in=ttl,
            refresh_expires_in=refresh_ttl,
            role=norm_role,
            id_token_verified=True,
            redirect_to=redirect_url,
        )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=body.model_dump(mode="json"),
        )

    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    return response


@router.get("/me", response_model=AuthMeResponse)
def auth_me(
    operator: Annotated[Operator | None, Depends(get_optional_operator)],
) -> AuthMeResponse:
    """
    Inspect the current operator using `Authorization: Bearer <access_token>`.

    TODO: Replace with unified auth dependency when vehicle binding / sessions land.
    """
    if operator is None:
        logger.debug("auth.me: unauthenticated (no valid Bearer token)")
        return AuthMeResponse(
            authenticated=False,
            operator=None,
            role=None,
            note="Send Authorization: Bearer <token> from /auth/esignet/callback response.",
        )
    logger.info("auth.me: authenticated operator_id=%s", operator.id)
    return AuthMeResponse(
        authenticated=True,
        operator=OperatorRead.model_validate(operator),
        role=normalize_operator_role(operator.role),
        note=None,
    )


@router.post("/logout")
def auth_logout() -> dict:
    """
    Stateless local logout placeholder.

    Clients should discard local access/refresh tokens. IdP logout is a separate
    eSignet flow and is not triggered here.
    """
    return {"ok": True, "note": "Delete local tokens on the client to complete logout."}


@router.post("/admin/login", response_model=ESignetCallbackResponse)
def auth_admin_login(
    body: AdminLoginBody,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> ESignetCallbackResponse:
    """
    Internal staff login (non-eSignet) for monitor/support/officer/admin/system_admin users.
    """
    email = body.email.strip().lower()
    stmt = select(Operator).where(Operator.email == email)
    op = session.exec(stmt).first()
    if op is None or not verify_password(body.password, op.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    role = normalize_operator_role(op.role)
    if role not in ("monitor", "support", "officer", "admin", "system_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account is not staff-enabled")
    access, access_ttl = create_operator_access_token(op.id, settings, role=role)
    refresh, refresh_ttl = create_operator_refresh_token(op.id, settings, role=role)
    base = settings.frontend_app_url.rstrip("/")
    rel_path = resolve_post_login_path(role, None, settings.oauth_next_paths_allowlist_set())
    redirect_url = f"{base}{rel_path}#access_token={access}&token_type=bearer&expires_in={access_ttl}&role={role}"
    return ESignetCallbackResponse(
        message="Signed in with local admin credentials",
        operator=OperatorRead.model_validate(op),
        access_token=access,
        refresh_token=refresh,
        expires_in=access_ttl,
        refresh_expires_in=refresh_ttl,
        role=role,
        auth_provider="local_admin",
        id_token_verified=False,
        redirect_to=redirect_url,
    )


@router.post("/rider/login", response_model=ESignetCallbackResponse)
def auth_rider_login(
    body: RiderLoginBody,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> ESignetCallbackResponse:
    """
    Rider/passenger daily login (local credentials), separate from onboarding eSignet verification.
    """
    phone = (body.phone or "").strip().replace(" ", "")
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Phone number is required")
    variants = [phone]
    if phone.startswith("+"):
        variants.append(phone[1:])
    else:
        variants.append(f"+{phone}")
    stmt = select(Operator).where(Operator.phone.in_(list(dict.fromkeys(variants))))
    op = session.exec(stmt).first()
    if op is None or not verify_password(body.password, op.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    role = normalize_operator_role(op.role)
    if role != "passenger":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="This login path is for riders only")
    access, access_ttl = create_operator_access_token(op.id, settings, role=role)
    refresh, refresh_ttl = create_operator_refresh_token(op.id, settings, role=role)
    base = settings.frontend_app_url.rstrip("/")
    rel_path = resolve_post_login_path(role, None, settings.oauth_next_paths_allowlist_set())
    redirect_url = f"{base}{rel_path}#access_token={access}&token_type=bearer&expires_in={access_ttl}&role={role}"
    msg = (
        "Signed in. Rider account is pending eSignet verification."
        if op.esignet_verified_at is None
        else "Signed in with rider credentials"
    )
    return ESignetCallbackResponse(
        message=msg,
        operator=OperatorRead.model_validate(op),
        access_token=access,
        refresh_token=refresh,
        expires_in=access_ttl,
        refresh_expires_in=refresh_ttl,
        role=role,
        auth_provider="local_rider",
        id_token_verified=False,
        redirect_to=redirect_url,
    )


@router.post("/driver/login", response_model=ESignetCallbackResponse)
def auth_driver_login(
    body: RiderLoginBody,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> ESignetCallbackResponse:
    """
    Driver daily login (phone + password). eSignet is used only during onboarding.
    """
    phone = (body.phone or "").strip().replace(" ", "")
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Phone number is required")
    variants = [phone]
    if phone.startswith("+"):
        variants.append(phone[1:])
    else:
        variants.append(f"+{phone}")
    stmt = select(Operator).where(Operator.phone.in_(list(dict.fromkeys(variants))))
    op = session.exec(stmt).first()
    if op is None or not verify_password(body.password, op.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    role = normalize_operator_role(op.role)
    if role not in ("driver", "operator"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="This login path is for drivers only")
    access, access_ttl = create_operator_access_token(op.id, settings, role=role)
    refresh, refresh_ttl = create_operator_refresh_token(op.id, settings, role=role)
    base = settings.frontend_app_url.rstrip("/")
    rel_path = resolve_post_login_path(role, None, settings.oauth_next_paths_allowlist_set())
    redirect_url = f"{base}{rel_path}#access_token={access}&token_type=bearer&expires_in={access_ttl}&role={role}"
    return ESignetCallbackResponse(
        message="Signed in with driver credentials",
        operator=OperatorRead.model_validate(op),
        access_token=access,
        refresh_token=refresh,
        expires_in=access_ttl,
        refresh_expires_in=refresh_ttl,
        role=role,
        auth_provider="local_driver",
        id_token_verified=False,
        redirect_to=redirect_url,
    )


@router.post("/officers/users", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def auth_officer_create_officer(
    body: AdminCreateBody,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    """
    Officer/admin can create fellow corporate officers.
    """
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email is required")
    existing = session.exec(select(Operator).where(Operator.email == email)).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already exists")
    actor_role = normalize_operator_role(actor.role)
    if actor_role not in ("officer", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Officer or admin role required")
    if actor.corporate_body_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Your account is not attached to a corporate body")
    op = Operator(
        external_subject_id=f"local-officer:{email}",
        full_name=(body.full_name or "").strip() or None,
        email=email,
        auth_provider="local_admin",
        status="ACTIVE",
        role="officer",
        corporate_body_id=actor.corporate_body_id,
        password_hash=hash_password(body.password),
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return OperatorRead.model_validate(op)


@router.post("/admin/users", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def auth_admin_create_user(
    body: AdminCreateBody,
    _actor: Annotated[Operator, Depends(require_system_admin_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    """
    Create internal accounts reserved for `system_admin`.

    Allowed:
    - platform admins (monitor/support/admin/system_admin)
    - officers

    Not allowed:
    - passenger/rider creation (association workflows own rider onboarding)
    """
    role = normalize_operator_role(body.role)
    if role in ("driver", "passenger"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="System admins cannot create driver/rider accounts",
        )
    if role not in PLATFORM_ADMIN_ROLES | OPERATOR_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid role for system-admin provisioning")
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email is required")
    existing = session.exec(select(Operator).where(Operator.email == email)).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already exists")
    subject_prefix = "local-admin" if role in PLATFORM_ADMIN_ROLES else "local-operator"
    op = Operator(
        external_subject_id=f"{subject_prefix}:{email}",
        full_name=(body.full_name or "").strip() or None,
        email=email,
        auth_provider="local_admin",
        status="ACTIVE",
        role=role,
        password_hash=hash_password(body.password),
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return OperatorRead.model_validate(op)


@router.post("/admin/bootstrap", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def auth_admin_bootstrap(
    body: AdminBootstrapBody,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> OperatorRead:
    """
    Create the first local `system_admin` account when none exists.

    Guardrails:
    - requires DEBUG=true
    - requires ADMIN_BOOTSTRAP_SECRET configured and matched
    - denied once any system_admin already exists
    """
    if not settings.debug:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Bootstrap disabled outside debug mode")
    expected = settings.admin_bootstrap_secret.strip()
    if not expected:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ADMIN_BOOTSTRAP_SECRET not configured")
    if body.bootstrap_secret != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid bootstrap secret")
    existing = session.exec(select(Operator).where(Operator.role == "system_admin")).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A system_admin already exists")
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email is required")
    op = Operator(
        external_subject_id=f"local-admin:{email}",
        full_name=(body.full_name or "").strip() or None,
        email=email,
        auth_provider="local_admin",
        status="ACTIVE",
        role="system_admin",
        password_hash=hash_password(body.password),
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return OperatorRead.model_validate(op)


@router.get("/me/consent-requests", response_model=list[ConsentRequestItem])
def auth_me_consent_requests(
    operator: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ConsentRequestItem]:
    rows = list_pending_for_operator(session, operator.id)
    return [ConsentRequestItem.model_validate(r) for r in rows]


@router.get("/me/consent-requests/{request_id}", response_model=ConsentRequestItem)
def auth_me_consent_request_one(
    request_id: UUID,
    operator: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> ConsentRequestItem:
    req = session.get(ConsentRequest, request_id)
    if req is None or req.operator_id != operator.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
    return ConsentRequestItem.model_validate(req)


@router.post("/me/consent-requests/{request_id}/respond")
def auth_me_consent_respond(
    request_id: UUID,
    body: ConsentRespondBody,
    operator: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> dict:
    logger.info(
        "consent.respond request_id=%s operator_id=%s approve=%s",
        request_id,
        operator.id,
        body.approve,
    )
    req = respond_consent_request(
        session,
        settings,
        request_id=request_id,
        operator_id=operator.id,
        approve=body.approve,
    )
    if req is None:
        # Fetch the raw request to give a more helpful error message
        raw = session.get(ConsentRequest, request_id)
        if raw is None:
            detail = "Consent request not found"
        elif raw.operator_id != operator.id:
            detail = "This request does not belong to your account"
        elif raw.status != "pending":
            detail = f"Request is already {raw.status} and cannot be responded to"
        else:
            detail = "Request not found or not pending"
        logger.warning("consent.respond failed request_id=%s reason=%r", request_id, detail)
        raise HTTPException(status.HTTP_409_CONFLICT, detail=detail)
    logger.info("consent.respond ok request_id=%s status=%s", request_id, req.status)
    return {
        "status": req.status,
        "disclosure_token": req.disclosure_token,
        "disclosure_token_expires_at": req.disclosure_token_expires_at.isoformat()
        if req.disclosure_token_expires_at
        else None,
    }
