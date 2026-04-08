"""Outbound integration with Inji Certify (OpenID4VCI credential issuance)."""

from __future__ import annotations

import logging
import secrets
import time
from datetime import datetime
from typing import Any

import httpx
import jwt

from app.core.config import Settings
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle

logger = logging.getLogger(__name__)

CERTIFY_CREDENTIAL_ENDPOINT = "/v1/certify/issuance/credential"
SAFERIDE_DRIVER_CREDENTIAL_TYPE = "SafeRideDriverCredential"


class InjiCertifyConfigError(RuntimeError):
    """Raised when Inji is enabled but required settings are missing."""


class InjiCertifyService:
    """
    Builds OpenID4VCI issuance requests and POSTs to Inji Certify.

    Flow:
      1. Build a proof JWT (openid4vci-proof+jwt) signed with SafeRide's RSA key.
      2. POST to /v1/certify/issuance/credential with format=ldp_vc + proof.
      3. The eSignet access_token from the driver's login is used as Bearer so
         Certify can look up the driver's identity via the mock data provider.
    """

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    def _require_config(self) -> None:
        if not self._s.inji_certify_enable:
            raise InjiCertifyConfigError("Inji Certify is disabled (INJI_CERTIFY_ENABLE=false)")
        if not self._s.inji_certify_base_url.strip():
            raise InjiCertifyConfigError("INJI_CERTIFY_BASE_URL is not set")

    def _url(self, path: str) -> str:
        base = self._s.inji_certify_base_url.rstrip("/")
        p = path if path.startswith("/") else f"/{path}"
        return f"{base}{p}"

    def _credential_endpoint_url(self) -> str:
        return self._url(CERTIFY_CREDENTIAL_ENDPOINT)

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

        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": self._s.esignet_client_id or "saferide-client",
            "aud": self._credential_endpoint_url(),
            "iat": now,
            "exp": now + 300,
            "nonce": nonce or secrets.token_urlsafe(16),
        }
        # Include sub so Certify's data provider can resolve the identity
        subject = operator.individual_id or operator.external_subject_id
        if subject:
            payload["sub"] = subject

        headers: dict[str, str] = {"typ": "openid4vci-proof+jwt"}
        kid = self._s.esignet_private_key_kid.strip()
        if kid:
            headers["kid"] = kid

        alg = self._s.esignet_client_assertion_alg or "RS256"
        return jwt.encode(payload, private_pem, algorithm=alg, headers=headers)

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
                "@context": [
                    "https://www.w3.org/2018/credentials/v1",
                    "https://mosip.github.io/inji-config/vc-local-ed25519/context.json",
                ],
                "type": ["VerifiableCredential", SAFERIDE_DRIVER_CREDENTIAL_TYPE],
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
                "type": ["VerifiableCredential", "SafeRideVehicleBindingCredential"],
            },
            "proof": {
                "proof_type": "jwt",
                "jwt": proof_jwt,
            },
        }

    async def _post_issue(
        self, payload: dict[str, Any], access_token: str | None = None
    ) -> dict[str, Any]:
        self._require_config()
        url = self._credential_endpoint_url()
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
        self, operator: Operator, *, access_token: str | None = None
    ) -> dict[str, Any]:
        proof_jwt = self._build_proof_jwt(operator)
        payload = self._build_operator_payload(operator, proof_jwt)
        return await self._post_issue(payload, access_token)

    async def issue_vehicle_binding_credential(
        self,
        operator: Operator,
        vehicle: Vehicle,
        binding: OperatorVehicleBinding,
        *,
        access_token: str | None = None,
    ) -> dict[str, Any]:
        proof_jwt = self._build_proof_jwt(operator)
        payload = self._build_vehicle_payload(operator, vehicle, binding, proof_jwt)
        return await self._post_issue(payload, access_token)

    @staticmethod
    def normalize_issue_response(raw: dict[str, Any]) -> dict[str, Any]:
        """Extract a stable subset for persistence from the Certify response."""
        ext = (
            raw.get("credential_id")
            or raw.get("credentialId")
            or raw.get("id")
            or raw.get("vcId")
        )
        raw_ref = raw.get("reference") or raw.get("offer_id") or raw.get("transaction_id")
        if raw_ref is not None:
            raw_ref = str(raw_ref)
        issued = raw.get("issued_at") or raw.get("issuedAt")
        expires = raw.get("expires_at") or raw.get("expiresAt")
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
