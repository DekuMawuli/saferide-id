"""Create/update operators after successful IdP authentication."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.rbac import DEFAULT_ROLE
from app.db.models.operator import Operator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def upsert_operator_from_claims(session: Session, normalized: dict) -> Operator:
    """
    Find by `external_subject_id` or insert; refresh profile fields on each login.

    Falls back to phone-number matching so that seeded/pre-registered operators
    are linked to their real eSignet identity on first login rather than creating
    a duplicate record.  When a phone match is found the `external_subject_id` is
    updated to the real eSignet sub so all future lookups hit the primary index.

    `normalized` is produced by `ESignetService.normalize_claims`.
    """
    import logging
    _log = logging.getLogger(__name__)

    sub = normalized["external_subject_id"]
    stmt = select(Operator).where(Operator.external_subject_id == sub)
    existing = session.exec(stmt).first()

    # Phone-based identity reconciliation: if no exact sub match, look up by
    # phone so that pre-seeded operators are linked on first real eSignet login.
    if existing is None:
        phone = (normalized.get("phone") or "").strip().replace(" ", "")
        if phone:
            phone_variants = [phone, f"+{phone}"] if not phone.startswith("+") else [phone, phone[1:]]
            existing = session.exec(
                select(Operator).where(Operator.phone.in_(phone_variants))
            ).first()
            if existing is not None:
                _log.info(
                    "operator_service: linking eSignet sub to existing operator via phone "
                    "operator_id=%s old_sub=%s new_sub=%s phone=%s",
                    existing.id, existing.external_subject_id, sub, phone,
                )
                existing.external_subject_id = sub

    now = _utcnow()

    if existing:
        existing.full_name = normalized.get("full_name") or existing.full_name
        existing.email = normalized.get("email") or existing.email
        existing.phone = normalized.get("phone") or existing.phone
        existing.photo_ref = normalized.get("photo_ref") or existing.photo_ref
        existing.individual_id = normalized.get("individual_id") or existing.individual_id
        existing.gender = normalized.get("gender") or existing.gender
        existing.birthdate = normalized.get("birthdate") or existing.birthdate
        existing.registration_type = normalized.get("registration_type") or existing.registration_type
        existing.acr = normalized.get("acr") or existing.acr
        existing.esignet_verified_at = now
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    op = Operator(
        external_subject_id=sub,
        full_name=normalized.get("full_name"),
        email=normalized.get("email"),
        phone=normalized.get("phone"),
        photo_ref=normalized.get("photo_ref"),
        individual_id=normalized.get("individual_id"),
        gender=normalized.get("gender"),
        birthdate=normalized.get("birthdate"),
        registration_type=normalized.get("registration_type"),
        acr=normalized.get("acr"),
        auth_provider="esignet",
        esignet_verified_at=now,
        status="PENDING",
        role=DEFAULT_ROLE,
        created_at=now,
        updated_at=now,
    )
    session.add(op)
    session.commit()
    session.refresh(op)
    return op
