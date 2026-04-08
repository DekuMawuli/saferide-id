"""Helpers for reading the local mock-identity registry in dev/test flows."""

from __future__ import annotations

import json
import logging
from typing import Any

import psycopg
from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models.operator import Operator

logger = logging.getLogger(__name__)


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().replace(" ", "")
    return normalized or None


def _phone_variants(value: str | None) -> list[str]:
    phone = _normalize_phone(value)
    if not phone:
        return []
    variants = [phone]
    if phone.startswith("+"):
        variants.append(phone[1:])
    else:
        variants.append(f"+{phone}")
    seen: list[str] = []
    for item in variants:
        if item and item not in seen:
            seen.append(item)
    return seen


def _first_text(value: Any) -> str | None:
    if isinstance(value, str):
        v = value.strip()
        return v or None
    if isinstance(value, dict):
        for key in ("value", "text", "name"):
            out = _first_text(value.get(key))
            if out:
                return out
        return None
    if isinstance(value, list):
        for item in value:
            out = _first_text(item)
            if out:
                return out
    return None


def lookup_mock_identity_by_phone(settings: Settings, phone: str | None) -> dict[str, Any] | None:
    """
    Resolve a mock-identity row by phone number.

    This is a local-dev fallback for cases where eSignet userinfo omits
    `individual_id` even though the same person exists in mock-identity-system.
    """
    dsn = (settings.mock_identity_database_url or "").strip()
    variants = _phone_variants(phone)
    if not dsn or not variants:
        return None

    query = """
        select individual_id, identity_json
        from mockidentitysystem.mock_identity
        where replace(coalesce(identity_json::jsonb ->> 'phone', ''), ' ', '') = any(%s)
        order by individual_id
        limit 1
    """
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(query, (variants,))
                row = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        logger.warning("mock_identity.lookup failed phone=%s error=%s", phone, exc)
        return None

    if not row:
        return None

    individual_id, identity_json = row
    try:
        payload = json.loads(identity_json)
    except Exception:  # noqa: BLE001
        payload = {}
    return {
        "individual_id": (individual_id or "").strip() or None,
        "phone": _normalize_phone(payload.get("phone")),
        "full_name": _first_text(payload.get("fullName")) or _first_text(payload.get("givenName")),
        "birthdate": _first_text(payload.get("dateOfBirth")),
        "gender": _first_text(payload.get("gender")),
        "email": _first_text(payload.get("email")),
    }


def hydrate_operator_from_mock_identity(
    session: Session,
    settings: Settings,
    operator: Operator,
) -> bool:
    """
    Fill missing operator identity fields from the local mock-identity registry.

    Returns True when the operator was changed and persisted.
    """
    if operator is None:
        return False
    if (operator.individual_id or "").strip():
        return False

    resolved = lookup_mock_identity_by_phone(settings, operator.phone)
    if not resolved or not resolved.get("individual_id"):
        return False

    existing = session.exec(
        select(Operator).where(Operator.individual_id == resolved["individual_id"])
    ).first()
    if existing is not None and existing.id != operator.id:
        logger.warning(
            "mock_identity.hydrate skipped operator_id=%s individual_id=%s already on operator_id=%s",
            operator.id,
            resolved["individual_id"],
            existing.id,
        )
        return False

    operator.individual_id = resolved["individual_id"]
    operator.full_name = operator.full_name or resolved.get("full_name")
    operator.email = operator.email or resolved.get("email")
    operator.birthdate = operator.birthdate or resolved.get("birthdate")
    operator.gender = operator.gender or resolved.get("gender")
    session.add(operator)
    session.commit()
    session.refresh(operator)
    logger.info(
        "mock_identity.hydrate operator_id=%s phone=%s individual_id=%s",
        operator.id,
        operator.phone,
        operator.individual_id,
    )
    return True
