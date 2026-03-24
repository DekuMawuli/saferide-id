"""Browser OAuth with eSignet and SafeRide-issued API tokens."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.rbac import (
    normalize_operator_role,
    resolve_post_login_path,
    sanitize_next_path,
)
from app.core.security import (
    OAUTH_STATE_COOKIE_NAME,
    decode_operator_access_token,
    generate_oauth_state,
    sign_oauth_state_cookie,
    verify_oauth_state_cookie,
    create_operator_access_token,
)
from app.db.models.consent_request import ConsentRequest
from app.db.models.operator import Operator
from app.db.session import get_session
from app.schemas.auth import AuthMeResponse, ESignetCallbackResponse
from app.schemas.operator import OperatorRead
from app.schemas.public_consent import ConsentRequestItem, ConsentRespondBody
from app.services.esignet_service import ESignetConfigError, ESignetService
from app.services.consent_service import list_pending_for_operator, respond_consent_request
from app.services.operator_service import upsert_operator_from_claims

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


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
    """Officer or admin only (SACCO / authority tooling)."""
    r = normalize_operator_role(operator.role)
    if r not in ("officer", "admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Officer or admin role required",
        )
    return operator


@router.get("/esignet/login")
async def esignet_login(
    settings: Annotated[Settings, Depends(get_settings_dep)],
    esignet: Annotated[ESignetService, Depends(get_esignet_service)],
    next: str | None = Query(
        default=None,
        description="Optional post-login path on the frontend (must be allowlisted)",
    ),
) -> RedirectResponse:
    """
    Start OIDC authorization code flow: redirect browser to eSignet.

    Stores CSRF `state` in a signed HttpOnly cookie bound to this browser.
    """
    logger.info("auth.esignet.login: starting OIDC redirect")
    try:
        state = generate_oauth_state()
        url = esignet.get_authorization_url(state)
    except ESignetConfigError as exc:
        logger.error("auth.esignet.login: eSignet misconfigured: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    allow = settings.oauth_next_paths_allowlist_set()
    next_path = sanitize_next_path(next, allow)
    if next and next_path is None:
        logger.warning("auth.esignet.login: rejected disallowed next=%s", next[:80])
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Query `next` is not an allowlisted path",
        )

    logger.debug("auth.esignet.login: redirect to authorize endpoint (state issued)")
    response = RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=OAUTH_STATE_COOKIE_NAME,
        value=sign_oauth_state_cookie(state, settings, next_path=next_path),
        httponly=True,
        max_age=600,
        samesite="lax",
        secure=not settings.debug,
        path="/",
    )
    logger.info("auth.esignet.login: 302 to IdP, OAuth state cookie set")
    return response


@router.get("/esignet/callback", response_model=None)
async def esignet_callback(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings_dep)],
    session: Annotated[Session, Depends(get_session)],
    esignet: Annotated[ESignetService, Depends(get_esignet_service)],
    code: str | None = None,
    state: str | None = None,
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
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={
                "error": error,
                "error_description": error_description or "",
            },
        )
    if not code or not state:
        logger.warning("auth.esignet.callback: missing code or state")
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Missing `code` or `state` query parameters",
        )

    raw_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    if not raw_cookie:
        logger.warning("auth.esignet.callback: missing OAuth state cookie")
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state cookie; restart login from /auth/esignet/login",
        )
    try:
        expected_state, next_from_cookie = verify_oauth_state_cookie(raw_cookie, settings)
    except InvalidTokenError as exc:
        logger.warning("auth.esignet.callback: invalid state cookie: %s", exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state cookie",
        ) from exc
    if state != expected_state:
        logger.warning("auth.esignet.callback: state mismatch (possible CSRF)")
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="OAuth `state` mismatch (possible CSRF)",
        )

    logger.debug("auth.esignet.callback: exchanging authorization code for tokens")
    try:
        token_payload = await esignet.exchange_code_for_token(code)
    except ValueError as exc:
        logger.error("auth.esignet.callback: token response parse error: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.exception("eSignet token exchange failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"eSignet token endpoint error: {exc.response.text[:500]}",
        ) from exc
    except httpx.RequestError as exc:
        logger.exception("eSignet token network error")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach eSignet token endpoint: {exc}",
        ) from exc

    access_token = token_payload.get("access_token")
    if not access_token or not isinstance(access_token, str):
        logger.error("auth.esignet.callback: token payload missing access_token")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="eSignet token response did not include access_token",
        )

    logger.debug("auth.esignet.callback: fetching userinfo")
    try:
        userinfo_raw = await esignet.fetch_userinfo(access_token)
    except httpx.HTTPStatusError as exc:
        logger.exception("eSignet userinfo failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"eSignet userinfo error: {exc.response.text[:500]}",
        ) from exc

    try:
        claims = esignet.verify_and_parse_userinfo(userinfo_raw)
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
    operator = upsert_operator_from_claims(session, normalized)
    norm_role = normalize_operator_role(operator.role)
    if operator.role != norm_role:
        operator.role = norm_role
        session.add(operator)
        session.commit()
        session.refresh(operator)

    api_token, ttl = create_operator_access_token(operator.id, settings, role=norm_role)
    allow = settings.oauth_next_paths_allowlist_set()
    rel_path = resolve_post_login_path(norm_role, next_from_cookie, allow)
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
            expires_in=ttl,
            role=norm_role,
            redirect_to=redirect_url,
        )
        response = JSONResponse(
            status_code=status.HTTP_200_OK,
            content=body.model_dump(mode="json"),
        )
        response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path="/")
        return response

    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path="/")
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
    req = respond_consent_request(
        session,
        settings,
        request_id=request_id,
        operator_id=operator.id,
        approve=body.approve,
    )
    if req is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Request not found, not pending, or not yours",
        )
    return {
        "status": req.status,
        "disclosure_token": req.disclosure_token,
        "disclosure_token_expires_at": req.disclosure_token_expires_at.isoformat()
        if req.disclosure_token_expires_at
        else None,
    }
