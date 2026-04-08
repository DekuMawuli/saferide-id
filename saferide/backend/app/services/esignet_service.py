"""MOSIP eSignet OIDC client with PKCE + private_key_jwt + JWKS ID token verification."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import secrets
import time
import uuid
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt.exceptions import InvalidTokenError, PyJWTError

from app.core.config import Settings
from app.schemas.auth import ESignetTokenResponse
from app.services.jwks_service import jwks_service

logger = logging.getLogger(__name__)

CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
VCI_SCOPE = "saferide_driver_vc_ldp"


class MissingConfigError(RuntimeError):
    """Raised when mandatory eSignet settings are missing."""


class TokenExchangeError(RuntimeError):
    """Raised when token endpoint exchange fails."""


class IdTokenVerificationError(RuntimeError):
    """Raised when ID token is invalid."""


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
                ("ESIGNET_ISSUER", self._s.esignet_issuer),
                ("ESIGNET_AUTHORIZATION_ENDPOINT", self._s.esignet_authorization_url),
                ("ESIGNET_TOKEN_ENDPOINT", self._s.esignet_token_url),
                ("ESIGNET_USERINFO_ENDPOINT", self._s.esignet_userinfo_url),
                ("ESIGNET_JWKS_URI", self._s.esignet_jwks_uri),
                ("ESIGNET_CLIENT_ID", self._s.esignet_client_id),
                ("ESIGNET_REDIRECT_URI", self._s.esignet_redirect_uri),
                ("ESIGNET_PRIVATE_KEY_PATH", str(self._s.esignet_private_key_path or "")),
            )
            if not val
        ]
        if missing:
            raise MissingConfigError(
                f"Missing required eSignet configuration: {', '.join(missing)}"
            )

    def get_authorization_url(self, *, state: str, code_challenge: str, nonce: str) -> str:
        """Build the browser redirect URL for the OIDC authorization endpoint."""
        self._require_oidc_urls()
        params: dict[str, str] = {
            "response_type": "code",
            "client_id": self._s.esignet_client_id,
            "redirect_uri": self._s.esignet_redirect_uri,
            "scope": self._s.esignet_scopes.strip(),
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        acr = self._s.esignet_acr_values.strip()
        if acr:
            params["acr_values"] = acr
        query = urlencode(params)
        return f"{self._s.esignet_authorization_url}?{query}"

    def _build_client_assertion_jwt(self) -> str:
        """RFC 7523 private_key_jwt for token endpoint authentication."""
        path = self._s.esignet_private_key_path
        if path is None or not path.is_file():
            raise MissingConfigError("ESIGNET_PRIVATE_KEY_PATH is missing or unreadable")
        with path.open(encoding="utf-8") as f:
            private_pem = f.read()
        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": self._s.esignet_client_id,
            "sub": self._s.esignet_client_id,
            "aud": self._s.esignet_token_url,
            "jti": str(uuid.uuid4()),
            "exp": now + 300,
            "iat": now,
        }
        headers: dict[str, str] = {"typ": "JWT"}
        kid = self._s.esignet_private_key_kid.strip()
        if kid:
            headers["kid"] = kid
        return jwt.encode(
            payload,
            private_pem,
            algorithm=self._s.esignet_client_assertion_alg,
            headers=headers,
        )

    @staticmethod
    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

    def _build_pkce_verifier_pair(self) -> tuple[str, str]:
        verifier = secrets.token_urlsafe(64)[:86]
        challenge = self._b64url(hashlib.sha256(verifier.encode("utf-8")).digest())
        return verifier, challenge

    def _api_url(self, path: str) -> str:
        base = self._s.esignet_base_url.rstrip("/")
        suffix = path if path.startswith("/") else f"/{path}"
        return f"{base}/v1/esignet{suffix}"

    @staticmethod
    def _request_wrapper(payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "requestTime": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "request": payload,
        }

    @staticmethod
    def _oauth_details_hash(oauth_response: dict[str, Any]) -> str:
        digest = hashlib.sha256(
            json.dumps(oauth_response, separators=(",", ":")).encode("utf-8")
        ).digest()
        return ESignetService._b64url(digest)

    @staticmethod
    def _extract_response_or_raise(step: str, body: dict[str, Any]) -> dict[str, Any]:
        errors = body.get("errors") or []
        if errors:
            first = errors[0] if isinstance(errors, list) and errors else {}
            code = first.get("errorCode") or "unknown_error"
            msg = first.get("errorMessage") or code
            raise TokenExchangeError(f"{step} failed: {code}: {msg}")
        response = body.get("response")
        if not isinstance(response, dict):
            raise TokenExchangeError(f"{step} returned no response payload")
        return response

    async def exchange_code_for_token(self, *, code: str, code_verifier: str | None = None) -> ESignetTokenResponse:
        """Exchange an authorization code for tokens at the eSignet token endpoint."""
        self._require_oidc_urls()
        data: dict[str, str] = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._s.esignet_redirect_uri,
            "client_id": self._s.esignet_client_id,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier
        assertion = self._build_client_assertion_jwt()
        data["client_assertion"] = assertion
        data["client_assertion_type"] = CLIENT_ASSERTION_TYPE
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._s.esignet_token_url,
                data=data,
                headers={"Accept": "application/json"},
            )
        if response.status_code >= 400:
            detail = response.text[:2000]
            logger.error("eSignet token endpoint error %s: %s", response.status_code, detail)
            raise TokenExchangeError(f"Token endpoint rejected authorization code ({response.status_code})")
        try:
            body = response.json()
        except ValueError as exc:
            raise TokenExchangeError("eSignet token response was not valid JSON") from exc
        try:
            return ESignetTokenResponse.model_validate(body)
        except Exception as exc:  # noqa: BLE001
            raise TokenExchangeError(f"Token payload shape invalid: {exc}") from exc

    async def exchange_vci_token(self, *, individual_id: str, scope: str = VCI_SCOPE) -> ESignetTokenResponse:
        """
        Complete the local browserless VCI auth-code flow and return a
        credential-scoped access token plus the `c_nonce` required by Certify.
        """
        self._require_oidc_urls()
        if not individual_id.strip():
            raise TokenExchangeError("VCI token flow requires a non-empty individual_id")

        code_verifier, code_challenge = self._build_pkce_verifier_pair()
        acr_values = self._s.esignet_acr_values.strip() or "mosip:idp:acr:generated-code"
        otp_channels = [
            item.strip()
            for item in self._s.esignet_vci_otp_channels.split(",")
            if item.strip()
        ] or ["email", "phone"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            csrf_resp = await client.get(self._api_url("/csrf/token"))
            csrf_resp.raise_for_status()
            csrf_body = csrf_resp.json()
            csrf_token = str(csrf_body.get("token") or "").strip()
            if not csrf_token:
                raise TokenExchangeError("VCI auth flow did not receive a CSRF token")

            oauth_resp = await client.post(
                self._api_url("/authorization/v2/oauth-details"),
                headers={"X-XSRF-TOKEN": csrf_token, "Content-Type": "application/json"},
                json=self._request_wrapper(
                    {
                        "clientId": self._s.esignet_client_id,
                        "scope": scope,
                        "responseType": "code",
                        "redirectUri": self._s.esignet_redirect_uri,
                        "display": "popup",
                        "prompt": "login",
                        "acrValues": acr_values,
                        "nonce": secrets.token_urlsafe(12),
                        "state": secrets.token_urlsafe(12),
                        "claimsLocales": "en",
                        "codeChallenge": code_challenge,
                        "codeChallengeMethod": "S256",
                    }
                ),
            )
            oauth_resp.raise_for_status()
            oauth_body = oauth_resp.json()
            oauth_details = self._extract_response_or_raise("VCI oauth-details", oauth_body)
            transaction_id = str(oauth_details.get("transactionId") or "").strip()
            if not transaction_id:
                raise TokenExchangeError("VCI oauth-details did not return a transactionId")

            flow_headers = {
                "X-XSRF-TOKEN": csrf_token,
                "oauth-details-key": transaction_id,
                "oauth-details-hash": self._oauth_details_hash(oauth_details),
                "Content-Type": "application/json",
            }

            send_otp_resp = await client.post(
                self._api_url("/authorization/send-otp"),
                headers=flow_headers,
                json=self._request_wrapper(
                    {
                        "transactionId": transaction_id,
                        "individualId": individual_id,
                        "otpChannels": otp_channels,
                        "captchaToken": "dummy",
                    }
                ),
            )
            send_otp_resp.raise_for_status()
            self._extract_response_or_raise("VCI send-otp", send_otp_resp.json())

            authenticate_resp = await client.post(
                self._api_url("/authorization/v3/authenticate"),
                headers=flow_headers,
                json=self._request_wrapper(
                    {
                        "transactionId": transaction_id,
                        "individualId": individual_id,
                        "challengeList": [
                            {
                                "authFactorType": "OTP",
                                "challenge": self._s.esignet_vci_otp,
                                "format": "alpha-numeric",
                            }
                        ],
                    }
                ),
            )
            authenticate_resp.raise_for_status()
            self._extract_response_or_raise("VCI authenticate", authenticate_resp.json())

            auth_code_resp = await client.post(
                self._api_url("/authorization/auth-code"),
                headers=flow_headers,
                json=self._request_wrapper(
                    {
                        "transactionId": transaction_id,
                        "acceptedClaims": [],
                        "permittedAuthorizeScopes": [],
                    }
                ),
            )
            auth_code_resp.raise_for_status()
            auth_code_data = self._extract_response_or_raise("VCI auth-code", auth_code_resp.json())
            code = str(auth_code_data.get("code") or "").strip()
            if not code:
                raise TokenExchangeError("VCI auth-code did not return an authorization code")

        tokens = await self.exchange_code_for_token(code=code, code_verifier=code_verifier)
        if not tokens.c_nonce:
            raise TokenExchangeError("VCI token response did not include c_nonce")
        return tokens

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

    async def verify_id_token(self, id_token: str, *, nonce: str) -> dict[str, Any]:
        """Verify id_token signature + standard OIDC claims using JWKS."""
        self._require_oidc_urls()
        try:
            header = jwt.get_unverified_header(id_token)
        except PyJWTError as exc:
            raise IdTokenVerificationError(f"Malformed id_token header: {exc}") from exc
        kid = header.get("kid")
        key = await jwks_service.get_signing_key(self._s.esignet_jwks_uri, kid)
        try:
            claims = jwt.decode(
                id_token,
                key=key,
                algorithms=["RS256", "PS256"],
                audience=self._s.esignet_client_id,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except PyJWTError as exc:
            raise IdTokenVerificationError(f"id_token verification failed: {exc}") from exc
        token_issuer = str(claims.get("iss") or "").rstrip("/")
        allowed_issuers = {
            str(self._s.esignet_issuer or "").rstrip("/"),
            str(self._s.esignet_base_url or "").rstrip("/"),
        }
        base_issuer = str(self._s.esignet_issuer or "").rstrip("/")
        base_url = str(self._s.esignet_base_url or "").rstrip("/")
        if base_issuer:
            allowed_issuers.add(f"{base_issuer}/v1/esignet")
        if base_url:
            allowed_issuers.add(f"{base_url}/v1/esignet")
        allowed_issuers.discard("")
        if not token_issuer or token_issuer not in allowed_issuers:
            expected_display = ", ".join(sorted(allowed_issuers)) or "<none>"
            raise IdTokenVerificationError(
                f"id_token verification failed: Invalid issuer (got={token_issuer or '<empty>'}, expected one of: {expected_display})"
            )
        if nonce and claims.get("nonce") != nonce:
            raise IdTokenVerificationError("id_token nonce mismatch")
        return dict(claims)

    async def verify_and_parse_userinfo(self, userinfo_token_or_payload: dict | str) -> dict[str, Any]:
        """
        Normalize userinfo into a plain claims dict.

        - JSON object responses are passed through (already protected by TLS + access token).
        - Compact JWT strings are verified via JWKS using the kid from the JWT header.
        """
        if isinstance(userinfo_token_or_payload, dict):
            return dict(userinfo_token_or_payload)

        raw = str(userinfo_token_or_payload).strip()
        if raw.count(".") != 2:
            raise ValueError("userinfo body is not JSON and not a compact JWT")

        try:
            header = jwt.get_unverified_header(raw)
        except PyJWTError as exc:
            raise ValueError(f"Malformed userinfo JWT header: {exc}") from exc

        kid = header.get("kid")
        key = await jwks_service.get_signing_key(self._s.esignet_jwks_uri, kid)
        try:
            decoded = jwt.decode(
                raw,
                key=key,
                algorithms=["RS256", "PS256"],
                options={"verify_aud": False},
            )
        except InvalidTokenError as exc:
            raise ValueError(f"userinfo JWT signature verification failed: {exc}") from exc
        return dict(decoded)

    def normalize_claims(self, claims: dict[str, Any]) -> dict[str, Any]:
        """Map OIDC-style claims into SafeRide operator fields."""
        def _pick_text(value: Any) -> str | None:
            if isinstance(value, str):
                v = value.strip()
                return v or None
            if isinstance(value, dict):
                nested = (
                    value.get("value")
                    or value.get("name")
                    or value.get("text")
                    or value.get("number")
                    or value.get("id")
                )
                return _pick_text(nested)
            if isinstance(value, list):
                for item in value:
                    out = _pick_text(item)
                    if out:
                        return out
            return None

        def _pick_phone(value: Any) -> str | None:
            if isinstance(value, str):
                v = value.strip()
                return v or None
            if isinstance(value, dict):
                nested = (
                    value.get("value")
                    or value.get("number")
                    or value.get("phone_number")
                    or value.get("phone")
                    or value.get("mobile")
                    or value.get("mobile_number")
                    or value.get("msisdn")
                )
                return _pick_phone(nested)
            if isinstance(value, list):
                for item in value:
                    p = _pick_phone(item)
                    if p:
                        return p
            return None

        def _extract_phone(payload: dict[str, Any]) -> str | None:
            # Common direct claims.
            for key in ("phone_number", "phone", "mobile", "mobile_number", "msisdn"):
                p = _pick_phone(payload.get(key))
                if p:
                    return p
            # Common nested OIDC/eKYC shapes.
            nested_candidates = [
                payload.get("verified_claims"),
                payload.get("claims"),
                payload.get("identity"),
                payload.get("credentialSubject"),
                payload.get("vc"),
            ]
            for node in nested_candidates:
                if isinstance(node, dict):
                    for key in ("phone_number", "phone", "mobile", "mobile_number", "msisdn"):
                        p = _pick_phone(node.get(key))
                        if p:
                            return p
                    for sub in node.values():
                        p = _pick_phone(sub)
                        if p:
                            return p
            return None

        def _extract_individual_id(payload: dict[str, Any]) -> str | None:
            for key in ("individual_id", "individualId", "uin", "UIN", "vid", "VID"):
                value = _pick_text(payload.get(key))
                if value:
                    return value
            nested_candidates = [
                payload.get("verified_claims"),
                payload.get("claims"),
                payload.get("identity"),
                payload.get("credentialSubject"),
                payload.get("vc"),
            ]
            for node in nested_candidates:
                if isinstance(node, dict):
                    for key in ("individual_id", "individualId", "uin", "UIN", "vid", "VID"):
                        value = _pick_text(node.get(key))
                        if value:
                            return value
            return None

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

        phone = _extract_phone(claims)

        return {
            "external_subject_id": str(sub),
            "full_name": name,
            "email": claims.get("email"),
            "phone": phone,
            "photo_ref": claims.get("picture"),
            "individual_id": _extract_individual_id(claims),
            "gender": claims.get("gender"),
            "birthdate": claims.get("birthdate"),
            "registration_type": claims.get("registration_type"),
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
