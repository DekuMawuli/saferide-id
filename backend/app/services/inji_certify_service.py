"""Outbound integration with Inji Certify (issuance only; no wallet / verify here)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from app.core.config import Settings
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle

logger = logging.getLogger(__name__)


class InjiCertifyConfigError(RuntimeError):
    """Raised when Inji is enabled but required settings are missing."""


class InjiCertifyService:
    """
    Builds issuance payloads and POSTs to Inji Certify.

    TODO: Replace placeholder paths, headers, and JSON shapes with the contract
    from your Inji Certify deployment (OpenAPI / partner docs). Mapping is
    intentionally isolated here so routes and credential_service stay stable.
    """

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    def _require_config(self) -> None:
        if not self._s.inji_certify_enable:
            raise InjiCertifyConfigError("Inji Certify is disabled (INJI_CERTIFY_ENABLE=false)")
        if not self._s.inji_certify_base_url.strip():
            raise InjiCertifyConfigError("INJI_CERTIFY_BASE_URL is not set")
        if not self._s.inji_certify_issuer_id.strip():
            raise InjiCertifyConfigError("INJI_CERTIFY_ISSUER_ID is not set")

    def _url(self, path: str) -> str:
        base = self._s.inji_certify_base_url.rstrip("/")
        p = path if path.startswith("/") else f"/{path}"
        return f"{base}{p}"

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
        key = self._s.inji_certify_api_key.strip()
        if key:
            # TODO: Switch to X-API-Key or mTLS if your Inji deployment requires it.
            h["Authorization"] = f"Bearer {key}"
        return h

    async def _post_issue(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_config()
        url = self._url(path)
        logger.debug("inji_certify POST %s", url)
        async with httpx.AsyncClient(timeout=self._s.inji_certify_timeout) as client:
            response = await client.post(url, json=payload, headers=self._headers())
        if response.status_code >= 400:
            body = response.text[:2000]
            logger.error("inji_certify error %s: %s", response.status_code, body)
            response.raise_for_status()
        try:
            data = response.json()
        except ValueError as exc:
            raise ValueError("Inji Certify response was not JSON") from exc
        if not isinstance(data, dict):
            raise ValueError("Inji Certify JSON response must be an object")
        return data

    def _build_operator_payload(self, operator: Operator) -> dict[str, Any]:
        """
        Map Operator → Inji issuance body.

        TODO: Align field names with your VC template (claims, credentialSubject, etc.).
        """
        verified_at: str | None = None
        if operator.esignet_verified_at:
            verified_at = operator.esignet_verified_at.isoformat()
        return {
            "issuerId": self._s.inji_certify_issuer_id,
            "template": self._s.inji_certify_operator_credential_template,
            "subject": {
                "operatorId": str(operator.id),
                "externalSubjectId": operator.external_subject_id,
                "fullName": operator.full_name,
                "phone": operator.phone,
                "acr": operator.acr,
                "status": operator.status,
                "esignetVerifiedAt": verified_at,
                "authProvider": operator.auth_provider,
            },
        }

    def _build_vehicle_payload(
        self,
        operator: Operator,
        vehicle: Vehicle,
        binding: OperatorVehicleBinding,
    ) -> dict[str, Any]:
        """TODO: Align with Inji template for fleet / binding credentials."""
        return {
            "issuerId": self._s.inji_certify_issuer_id,
            "template": self._s.inji_certify_vehicle_credential_template,
            "subject": {
                "operatorId": str(operator.id),
                "vehicleId": str(vehicle.id),
                "bindingId": str(binding.id),
                "externalSubjectId": operator.external_subject_id,
                "vehicleExternalRef": vehicle.external_ref,
                "vehicleDisplayName": vehicle.display_name,
                "bindingValidFrom": binding.valid_from.isoformat() if binding.valid_from else None,
                "bindingValidUntil": binding.valid_until.isoformat() if binding.valid_until else None,
            },
        }

    async def issue_operator_credential(self, operator: Operator) -> dict[str, Any]:
        payload = self._build_operator_payload(operator)
        return await self._post_issue(self._s.inji_certify_operator_issue_path, payload)

    async def issue_vehicle_binding_credential(
        self,
        operator: Operator,
        vehicle: Vehicle,
        binding: OperatorVehicleBinding,
    ) -> dict[str, Any]:
        payload = self._build_vehicle_payload(operator, vehicle, binding)
        return await self._post_issue(self._s.inji_certify_vehicle_issue_path, payload)

    @staticmethod
    def normalize_issue_response(raw: dict[str, Any]) -> dict[str, Any]:
        """
        Extract a stable subset for persistence.

        TODO: Map real Inji fields (credentialId, vcJwt, sd-jwt, offerId, etc.).
        """
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
