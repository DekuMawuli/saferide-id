"""MOSIP eSignet OIDC client (server-side only; no proxy of IdP routes)."""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt.exceptions import InvalidTokenError, PyJWTError

from app.core.config import Settings

logger = logging.getLogger(__name__)

CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"


class ESignetConfigError(RuntimeError):
    """Raised when mandatory eSignet settings are missing."""


class ESignetService:
    """
    Encapsulates outbound calls to a running eSignet OIDC provider.

    This class does not expose eSignet URLs as FastAPI routes; callers use
    `app.api.auth` which orchestrates browser redirects and persistence.
    """

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    def _require_oidc_urls(self) -> None:
        missing = [
            name
            for name, val in (
                ("ESIGNET_AUTHORIZATION_URL", self._s.esignet_authorization_url),
                ("ESIGNET_TOKEN_URL", self._s.esignet_token_url),
                ("ESIGNET_USERINFO_URL", self._s.esignet_userinfo_url),
                ("ESIGNET_CLIENT_ID", self._s.esignet_client_id),
                ("ESIGNET_REDIRECT_URI", self._s.esignet_redirect_uri),
            )
            if not val
        ]
        if missing:
            raise ESignetConfigError(
                f"Missing required eSignet configuration: {', '.join(missing)}"
            )

    def get_authorization_url(self, state: str) -> str:
        """Build the browser redirect URL for the OIDC authorization endpoint."""
        self._require_oidc_urls()
        params: dict[str, str] = {
            "response_type": "code",
            "client_id": self._s.esignet_client_id,
            "redirect_uri": self._s.esignet_redirect_uri,
            "scope": self._s.esignet_scopes.strip(),
            "state": state,
        }
        acr = self._s.esignet_acr_values.strip()
        if acr:
            params["acr_values"] = acr
        query = urlencode(params)
        return f"{self._s.esignet_authorization_url}?{query}"

    def _build_client_assertion_jwt(self) -> str | None:
        """
        RFC 7523 private_key_jwt for the token endpoint.

        Returns None if no private key is configured (some dev stacks accept
        code exchange without client authentication — not for production).
        """
        path = self._s.esignet_private_key_path
        if path is None or not path.is_file():
            return None
        with path.open(encoding="utf-8") as f:
            private_pem = f.read()
        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": self._s.esignet_client_id,
            "sub": self._s.esignet_client_id,
            # TODO: Confirm `aud` with your eSignet version (string vs list, realm path).
            "aud": self._s.esignet_token_url,
            "jti": secrets.token_urlsafe(24),
            "exp": now + 300,
            "iat": now,
        }
        return jwt.encode(payload, private_pem, algorithm="RS256")

    async def exchange_code_for_token(self, code: str) -> dict[str, Any]:
        """Exchange an authorization code for tokens at the eSignet token endpoint."""
        self._require_oidc_urls()
        data: dict[str, str] = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._s.esignet_redirect_uri,
            "client_id": self._s.esignet_client_id,
        }
        assertion = self._build_client_assertion_jwt()
        if assertion:
            data["client_assertion"] = assertion
            data["client_assertion_type"] = CLIENT_ASSERTION_TYPE
        else:
            logger.warning(
                "eSignet token exchange without private_key_jwt; "
                "set ESIGNET_PRIVATE_KEY_PATH for production integrations."
            )
        # TODO: Add PKCE (`code_verifier`) when your eSignet client registration requires it.
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._s.esignet_token_url,
                data=data,
                headers={"Accept": "application/json"},
            )
        if response.status_code >= 400:
            detail = response.text[:2000]
            logger.error("eSignet token endpoint error %s: %s", response.status_code, detail)
            response.raise_for_status()
        try:
            return response.json()
        except ValueError as exc:
            raise ValueError("eSignet token response was not valid JSON") from exc

    async def fetch_userinfo(self, access_token: str) -> dict | str:
        """Call the OIDC userinfo endpoint with the access token."""
        self._require_oidc_urls()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json, application/jwt, text/plain",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(self._s.esignet_userinfo_url, headers=headers)
        if response.status_code >= 400:
            logger.error(
                "eSignet userinfo error %s: %s",
                response.status_code,
                response.text[:2000],
            )
            response.raise_for_status()
        content_type = (response.headers.get("content-type") or "").lower()
        if "application/json" in content_type:
            return response.json()
        return response.text

    def verify_and_parse_userinfo(self, userinfo_token_or_payload: dict | str) -> dict[str, Any]:
        """
        Normalize userinfo into a plain claims dict.

        - JSON object responses are passed through (structure only — no signature).
        - Compact JWT strings are verified when `ESIGNET_PUBLIC_KEY_PATH` is set.

        TODO: Resolve signing keys from `jwks_uri` in ESIGNET_WELLKNOWN metadata
        (key rotation, ES256, issuer/audience alignment per MOSIP release).
        """
        if isinstance(userinfo_token_or_payload, dict):
            # TODO: If eSignet returns nested signed JWTs inside JSON, verify each fragment.
            return dict(userinfo_token_or_payload)

        raw = str(userinfo_token_or_payload).strip()
        if raw.count(".") != 2:
            raise ValueError("userinfo body is not JSON and not a compact JWT")

        pubkey_path = self._s.esignet_public_key_path
        if pubkey_path is not None and pubkey_path.is_file():
            with pubkey_path.open(encoding="utf-8") as f:
                public_pem = f.read()
            try:
                # TODO: Set verify_aud / issuer against eSignet metadata.
                decoded = jwt.decode(
                    raw,
                    public_pem,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                )
                return dict(decoded)
            except InvalidTokenError as exc:
                raise ValueError(f"userinfo JWT signature verification failed: {exc}") from exc

        logger.warning(
            "Decoding userinfo JWT without signature verification. "
            "Configure ESIGNET_PUBLIC_KEY_PATH or implement JWKS fetching."
        )
        try:
            decoded = jwt.decode(
                raw,
                options={"verify_signature": False},
                algorithms=["RS256", "ES256"],
            )
        except PyJWTError as exc:
            raise ValueError(f"failed to decode userinfo JWT: {exc}") from exc
        return dict(decoded)

    def normalize_claims(self, claims: dict[str, Any]) -> dict[str, Any]:
        """Map OIDC-style claims into SafeRide operator fields."""
        sub = claims.get("sub")
        if not sub:
            raise ValueError("eSignet userinfo is missing required `sub` claim")

        name = claims.get("name")
        if not name:
            given = (claims.get("given_name") or "").strip()
            family = (claims.get("family_name") or "").strip()
            name = f"{given} {family}".strip() or None

        raw_acr = claims.get("acr")
        acr: str | None
        if isinstance(raw_acr, str):
            acr = raw_acr
        elif isinstance(raw_acr, list) and raw_acr:
            acr = str(raw_acr[0])
        else:
            acr = None

        return {
            "external_subject_id": str(sub),
            "full_name": name,
            "phone": claims.get("phone_number") or claims.get("phone"),
            "photo_ref": claims.get("picture"),
            "acr": acr,
        }

    async def fetch_well_known_metadata(self) -> dict[str, Any]:
        """
        Optional helper for future JWKS / issuer validation.

        TODO: Cache metadata; drive JWT verification from `jwks_uri`.
        """
        url = self._s.esignet_wellknown_url.strip()
        if not url:
            return {}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
        return response.json()
