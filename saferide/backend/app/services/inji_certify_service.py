"""Outbound integration with Inji Certify (OpenID4VCI credential issuance)."""

from __future__ import annotations

import base64
import json
import logging
import secrets
import time
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from app.core.config import Settings
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle

logger = logging.getLogger(__name__)


class InjiCertifyConfigError(RuntimeError):
    """Raised when Inji is enabled but required settings are missing."""


class InjiCertifyService:
    """
    Builds OpenID4VCI issuance requests and POSTs to Inji Certify.

    Flow:
      1. Build a proof JWT (openid4vci-proof+jwt) signed with SafeRide's RSA key.
      2. POST to /v1/certify/issuance/credential with format=ldp_vc + proof.
      3. Use a credential-scoped eSignet access token as Bearer so Certify can
         validate the holder and a matching `c_nonce` in the proof JWT.
    """

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    def _require_config(self) -> None:
        if not self._s.inji_certify_enable:
            raise InjiCertifyConfigError("Inji Certify is disabled (INJI_CERTIFY_ENABLE=false)")
        self._require_base_url()

    def _require_base_url(self) -> None:
        if not self._s.inji_certify_base_url.strip():
            raise InjiCertifyConfigError("INJI_CERTIFY_BASE_URL is not set")

    def _url(self, path: str) -> str:
        self._require_base_url()
        base = self._s.inji_certify_base_url.rstrip("/")
        p = path if path.startswith("/") else f"/{path}"
        return f"{base}{p}"

    def _issuer_url(self) -> str:
        path = (self._s.inji_certify_credential_issuer_path or "").strip()
        if not path:
            raise InjiCertifyConfigError("INJI_CERTIFY_CREDENTIAL_ISSUER_PATH is not set")
        return self._url(path)

    def _credential_endpoint_url(self, path: str) -> str:
        if not path.strip():
            raise InjiCertifyConfigError("Inji Certify issuance path is not set")
        return self._url(path)

    def _build_proof_jwt(self, operator: Operator, nonce: str | None = None) -> str:
        """
        Build an OpenID4VCI proof JWT (openid4vci-proof+jwt) signed with
        SafeRide's RSA private key.  The `sub` is set to the operator's
        individual_id (MOSIP VID/UIN) so Certify's data provider can look up
        the identity in the mock registry.
        """
        path = self._s.esignet_private_key_path
        if path is None or not path.is_file():
            raise InjiCertifyConfigError(
                "ESIGNET_PRIVATE_KEY_PATH must point to a readable RSA private key "
                "to build the OpenID4VCI proof JWT"
            )
        with path.open(encoding="utf-8") as fh:
            private_pem = fh.read()
        private_key = serialization.load_pem_private_key(private_pem.encode("utf-8"), password=None)

        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": self._s.esignet_client_id or "saferide-client",
            "aud": self._proof_audience(),
            "iat": now,
            "exp": now + 300,
            "nonce": nonce or secrets.token_urlsafe(16),
        }
        # Include sub so Certify's data provider can resolve the identity
        subject = operator.individual_id or operator.external_subject_id
        if subject:
            payload["sub"] = subject

        headers: dict[str, Any] = {
            "typ": "openid4vci-proof+jwt",
            # Certify validates the proof against holder key material embedded in
            # the JWT header (`jwk`) or a DID `kid`. We expose the public JWK.
            "jwk": self._public_jwk(private_key),
        }

        alg = self._s.esignet_client_assertion_alg or "RS256"
        return jwt.encode(payload, private_pem, algorithm=alg, headers=headers)

    def _proof_audience(self) -> str:
        audience = (self._s.inji_certify_identifier or "").strip()
        if audience:
            return audience.rstrip("/")
        return self._s.inji_certify_base_url.rstrip("/")

    @staticmethod
    def _public_jwk(private_key: Any) -> dict[str, Any]:
        public_key = private_key.public_key()
        if isinstance(public_key, rsa.RSAPublicKey):
            numbers = public_key.public_numbers()
            return {
                "kty": "RSA",
                "n": InjiCertifyService._b64url_uint(numbers.n),
                "e": InjiCertifyService._b64url_uint(numbers.e),
                "alg": "RS256",
                "use": "sig",
            }
        if isinstance(public_key, ec.EllipticCurvePublicKey):
            numbers = public_key.public_numbers()
            curve_name = public_key.curve.name
            crv = {
                "secp256r1": "P-256",
                "secp384r1": "P-384",
                "secp521r1": "P-521",
            }.get(curve_name)
            if crv is None:
                raise InjiCertifyConfigError(f"Unsupported EC curve for proof JWK: {curve_name}")
            coord_len = (public_key.key_size + 7) // 8
            return {
                "kty": "EC",
                "crv": crv,
                "x": InjiCertifyService._b64url_bytes(numbers.x.to_bytes(coord_len, "big")),
                "y": InjiCertifyService._b64url_bytes(numbers.y.to_bytes(coord_len, "big")),
                "alg": "ES256",
                "use": "sig",
            }
        raise InjiCertifyConfigError(
            f"Unsupported private key type for OpenID4VCI proof: {type(private_key).__name__}"
        )

    @staticmethod
    def _b64url_uint(value: int) -> str:
        size = max(1, (value.bit_length() + 7) // 8)
        return InjiCertifyService._b64url_bytes(value.to_bytes(size, "big"))

    @staticmethod
    def _b64url_bytes(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")

    def _headers(self, access_token: str | None = None) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
        # Prefer the driver's eSignet access_token (required for Certify's
        # JWKS-based Bearer validation).  Fall back to a configured API key.
        bearer = access_token or self._s.inji_certify_api_key.strip()
        if bearer:
            h["Authorization"] = f"Bearer {bearer}"
        return h

    def _build_operator_payload(
        self, operator: Operator, proof_jwt: str
    ) -> dict[str, Any]:
        """
        OpenID4VCI credential request body (format=ldp_vc).

        credential_definition.type references the SafeRide driver credential
        type that must be registered in Certify via POST /credential-configurations.
        """
        return {
            "format": "ldp_vc",
            "credential_definition": {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                # Match Certify's registered credential type ordering exactly.
                "type": [self._s.inji_certify_operator_credential_template, "VerifiableCredential"],
            },
            "proof": {
                "proof_type": "jwt",
                "jwt": proof_jwt,
            },
        }

    def _build_vehicle_payload(
        self,
        operator: Operator,
        vehicle: Vehicle,
        binding: OperatorVehicleBinding,
        proof_jwt: str,
    ) -> dict[str, Any]:
        """OpenID4VCI credential request for a driver–vehicle binding."""
        return {
            "format": "ldp_vc",
            "credential_definition": {
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                "type": [self._s.inji_certify_vehicle_credential_template, "VerifiableCredential"],
            },
            "proof": {
                "proof_type": "jwt",
                "jwt": proof_jwt,
            },
        }

    async def _post_issue(
        self,
        path: str,
        payload: dict[str, Any],
        access_token: str | None = None,
    ) -> dict[str, Any]:
        self._require_config()
        url = self._credential_endpoint_url(path)
        logger.info("inji_certify: POST %s has_bearer=%s", url, bool(access_token))
        async with httpx.AsyncClient(timeout=self._s.inji_certify_timeout) as client:
            response = await client.post(
                url, json=payload, headers=self._headers(access_token)
            )
        logger.info("inji_certify: response status=%s url=%s", response.status_code, url)
        if response.status_code >= 400:
            body = response.text[:2000]
            logger.error("inji_certify: error %s body=%s", response.status_code, body)
            response.raise_for_status()
        try:
            data = response.json()
        except ValueError as exc:
            logger.error("inji_certify: non-JSON response url=%s body=%s", url, response.text[:500])
            raise ValueError("Inji Certify response was not JSON") from exc
        if not isinstance(data, dict):
            raise ValueError("Inji Certify JSON response must be an object")
        logger.info("inji_certify: success keys=%s", sorted(data.keys()))
        return data

    async def issue_operator_credential(
        self,
        operator: Operator,
        *,
        access_token: str | None = None,
        proof_nonce: str | None = None,
    ) -> dict[str, Any]:
        proof_jwt = self._build_proof_jwt(operator, nonce=proof_nonce)
        payload = self._build_operator_payload(operator, proof_jwt)
        return await self._post_issue(self._s.inji_certify_operator_issue_path, payload, access_token)

    async def issue_vehicle_binding_credential(
        self,
        operator: Operator,
        vehicle: Vehicle,
        binding: OperatorVehicleBinding,
        *,
        access_token: str | None = None,
        proof_nonce: str | None = None,
    ) -> dict[str, Any]:
        proof_jwt = self._build_proof_jwt(operator, nonce=proof_nonce)
        payload = self._build_vehicle_payload(operator, vehicle, binding, proof_jwt)
        return await self._post_issue(self._s.inji_certify_vehicle_issue_path, payload, access_token)

    def build_authorization_code_offer(self, credential_configuration_id: str) -> dict[str, Any]:
        if not credential_configuration_id.strip():
            raise InjiCertifyConfigError("Credential configuration id is required to build a wallet offer")
        return {
            "credential_issuer": self._issuer_url(),
            "credential_configuration_ids": [credential_configuration_id],
            "grants": {
                "authorization_code": {},
            },
        }

    def build_wallet_deep_link(self, credential_configuration_id: str) -> str:
        offer = self.build_authorization_code_offer(credential_configuration_id)
        encoded = quote(json.dumps(offer, separators=(",", ":")), safe="")
        return f"openid-credential-offer://?credential_offer={encoded}"

    def build_metadata_url(self) -> str:
        return f"{self._issuer_url()}/.well-known/openid-credential-issuer"

    @staticmethod
    def normalize_issue_response(raw: dict[str, Any]) -> dict[str, Any]:
        """Extract a stable subset for persistence from the Certify response."""
        credential = raw.get("credential")
        if not isinstance(credential, dict):
            credential = {}
        ext = (
            raw.get("credential_id")
            or raw.get("credentialId")
            or raw.get("id")
            or raw.get("vcId")
            or credential.get("id")
        )
        raw_ref = raw.get("reference") or raw.get("offer_id") or raw.get("transaction_id")
        if raw_ref is not None:
            raw_ref = str(raw_ref)
        issued = (
            raw.get("issued_at")
            or raw.get("issuedAt")
            or credential.get("issuanceDate")
        )
        expires = (
            raw.get("expires_at")
            or raw.get("expiresAt")
            or credential.get("expirationDate")
        )
        issued_at = InjiCertifyService._parse_dt(issued)
        expires_at = InjiCertifyService._parse_dt(expires)
        return {
            "external_credential_id": str(ext) if ext is not None else None,
            "raw_reference": raw_ref,
            "issued_at": issued_at,
            "expires_at": expires_at,
            "metadata": raw,
        }

    @staticmethod
    def _parse_dt(value: Any) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        return None
