"""OAuth state signing and SafeRide-issued access tokens (JWT)."""

from __future__ import annotations

import secrets
import time
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import Settings

# Cookie used to bind the browser to the OIDC `state` parameter (CSRF mitigation).
OAUTH_STATE_COOKIE_NAME = "sr_esignet_oauth"
OAUTH_STATE_TTL_SECONDS = 600
ALGORITHM_HS256 = "HS256"


def generate_oauth_state() -> str:
    """Return a high-entropy opaque `state` value for the authorize redirect."""
    return secrets.token_urlsafe(32)


def sign_oauth_state_cookie(
    state: str,
    settings: Settings,
    *,
    next_path: str | None = None,
) -> str:
    """Embed `state` (and optional validated `next` path) in a short-lived HttpOnly cookie JWT."""
    now = int(time.time())
    payload: dict[str, Any] = {
        "purpose": "esignet_oauth",
        "state": state,
        "iat": now,
        "exp": now + OAUTH_STATE_TTL_SECONDS,
    }
    if next_path:
        payload["next"] = next_path
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM_HS256)


def verify_oauth_state_cookie(token: str, settings: Settings) -> tuple[str, str | None]:
    """
    Decode the cookie JWT and return `(state, next_path)` where `next_path` may be None.

    Raises:
        InvalidTokenError: on bad signature, expiry, or wrong purpose.
    """
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[ALGORITHM_HS256],
        options={"require": ["exp", "iat"]},
    )
    if payload.get("purpose") != "esignet_oauth":
        raise InvalidTokenError("wrong purpose")
    state = payload.get("state")
    if not state or not isinstance(state, str):
        raise InvalidTokenError("missing state")
    raw_next = payload.get("next")
    next_path: str | None = raw_next if isinstance(raw_next, str) and raw_next else None
    return state, next_path


def create_operator_access_token(
    operator_id: UUID,
    settings: Settings,
    *,
    role: str,
) -> tuple[str, int]:
    """
    Mint a SafeRide API access token referencing the operator primary key.

    Returns:
        (jwt_string, expires_in_seconds)
    """
    now = int(time.time())
    ttl_sec = settings.access_token_expire_minutes * 60
    payload: dict[str, Any] = {
        "sub": str(operator_id),
        "typ": "operator_access",
        "role": role,
        "iat": now,
        "exp": now + ttl_sec,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM_HS256)
    return token, ttl_sec


def decode_operator_access_token(token: str, settings: Settings) -> UUID:
    """Validate a SafeRide access token and return the operator id."""
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[ALGORITHM_HS256],
        options={"require": ["exp", "sub", "typ"]},
    )
    if payload.get("typ") != "operator_access":
        raise InvalidTokenError("wrong token type")
    return UUID(str(payload["sub"]))
