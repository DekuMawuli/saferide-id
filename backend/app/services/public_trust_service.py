"""Resolve trust facts by disclosure tier (public, unauthenticated)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.core.trust_status import normalize_operator_status, trust_band_for_status
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.schemas.disclosure import TrustPublicResponse, TrustVehicleItem
from app.services.consent_service import validate_disclosure_token
from app.services.operator_lookup import get_operator_by_verify_short_code


def _mask_display_name(name: str | None) -> str | None:
    if not name or not name.strip():
        return None
    parts = name.strip().split()
    if len(parts) == 1:
        w = parts[0]
        return w[0] + "·" * min(3, max(1, len(w) - 1)) if len(w) > 1 else w
    return f"{parts[0]} {parts[-1][0]}."


def _mask_subject(sub: str) -> str:
    s = sub.strip()
    if len(s) <= 10:
        return "****"
    return f"{s[:4]}…{s[-4:]}"


def _vehicles_for_operator(session: Session, operator_id: UUID) -> list[TrustVehicleItem]:
    vstmt = (
        select(Vehicle)
        .join(
            OperatorVehicleBinding,
            OperatorVehicleBinding.vehicle_id == Vehicle.id,
        )
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.is_active == True)  # noqa: E712
    )
    out: list[TrustVehicleItem] = []
    for veh in session.exec(vstmt).all():
        out.append(
            TrustVehicleItem(
                plate=veh.external_ref or veh.display_name,
                display_name=veh.display_name,
            )
        )
    return out


def build_trust_response(
    session: Session,
    op: Operator,
    *,
    tier: str,
    consent_request_id: UUID | None = None,
) -> TrustPublicResponse:
    status = normalize_operator_status(op.status)
    band = trust_band_for_status(status)
    vehicles = _vehicles_for_operator(session, op.id)
    tier_norm = (tier or "standard").strip().lower()

    verified_iso: str | None = None
    if op.esignet_verified_at:
        verified_iso = op.esignet_verified_at.astimezone(timezone.utc).isoformat()

    if tier_norm == "minimal":
        return TrustPublicResponse(
            disclosure_tier="minimal",
            trust_band=band,
            status=status,
            display_name=_mask_display_name(op.full_name),
            operator_id=None,
            photo_url=None,
            phone=None,
            vehicles=vehicles,
            esignet_verified_at=None,
            external_subject_hint=None,
            consent_request_id=consent_request_id,
        )

    if tier_norm == "extended":
        return TrustPublicResponse(
            disclosure_tier="extended",
            trust_band=band,
            status=status,
            display_name=op.full_name,
            operator_id=op.id,
            photo_url=op.photo_ref,
            phone=op.phone,
            vehicles=vehicles,
            esignet_verified_at=verified_iso,
            external_subject_hint=_mask_subject(op.external_subject_id),
            consent_request_id=None,
        )

    # standard (default web)
    return TrustPublicResponse(
        disclosure_tier="standard",
        trust_band=band,
        status=status,
        display_name=op.full_name,
        operator_id=op.id,
        photo_url=op.photo_ref,
        phone=None,
        vehicles=vehicles,
        esignet_verified_at=None,
        external_subject_hint=None,
        consent_request_id=consent_request_id,
    )


def get_trust_public(
    session: Session,
    code: str,
    *,
    tier: str = "standard",
    disclosure_token: str | None = None,
) -> TrustPublicResponse | None:
    op = get_operator_by_verify_short_code(session, code)
    if op is None:
        return None
    tier_norm = (tier or "standard").strip().lower()
    if tier_norm == "extended":
        if not disclosure_token or not validate_disclosure_token(
            session, op.id, disclosure_token.strip()
        ):
            return None
    return build_trust_response(session, op, tier=tier_norm)
