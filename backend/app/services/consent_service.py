"""Consent requests and disclosure tokens."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models.consent_request import ConsentAuditEntry, ConsentRequest
from app.services.operator_lookup import get_operator_by_verify_short_code

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _audit(session: Session, request_id: UUID, action: str, detail: str | None = None) -> None:
    session.add(
        ConsentAuditEntry(consent_request_id=request_id, action=action, detail=detail)
    )


def create_consent_request(
    session: Session,
    settings: Settings,
    *,
    verify_short_code: str,
    channel: str,
    passenger_msisdn: str | None,
) -> ConsentRequest | None:
    op = get_operator_by_verify_short_code(session, verify_short_code)
    if op is None:
        return None
    now = _utcnow()
    ttl = timedelta(minutes=max(5, settings.consent_request_ttl_minutes))
    req = ConsentRequest(
        operator_id=op.id,
        status="pending",
        channel=(channel or "web")[:32],
        passenger_msisdn=(passenger_msisdn or None),
        verify_short_code=(verify_short_code or "").strip().upper(),
        expires_at=now + ttl,
        created_at=now,
        updated_at=now,
    )
    session.add(req)
    session.commit()
    session.refresh(req)
    session.add(
        ConsentAuditEntry(
            consent_request_id=req.id,
            action="created",
            detail=f"channel={channel}",
        )
    )
    session.commit()
    logger.info("consent.request id=%s operator_id=%s", req.id, op.id)
    return req


def get_consent_request(session: Session, request_id: UUID) -> ConsentRequest | None:
    return session.get(ConsentRequest, request_id)


def poll_consent_request(session: Session, request_id: UUID) -> dict:
    req = session.get(ConsentRequest, request_id)
    if req is None:
        return {"status": "not_found"}
    now = _utcnow()
    if req.status == "pending" and req.expires_at < now:
        req.status = "expired"
        req.updated_at = now
        session.add(req)
        _audit(session, req.id, "expired", None)
        session.commit()
    if req.status == "approved" and req.disclosure_token_expires_at and req.disclosure_token_expires_at < now:
        return {"status": "token_expired", "request_id": str(req.id)}
    if req.status != "approved":
        return {
            "status": req.status,
            "request_id": str(req.id),
        }
    return {
        "status": "approved",
        "request_id": str(req.id),
        "disclosure_token": req.disclosure_token,
        "disclosure_token_expires_at": req.disclosure_token_expires_at.isoformat()
        if req.disclosure_token_expires_at
        else None,
    }


def list_pending_for_operator(session: Session, operator_id: UUID) -> list[ConsentRequest]:
    now = _utcnow()
    stmt = (
        select(ConsentRequest)
        .where(ConsentRequest.operator_id == operator_id)
        .where(ConsentRequest.status == "pending")
        .where(ConsentRequest.expires_at >= now)
        .order_by(ConsentRequest.created_at.desc())
    )
    return list(session.exec(stmt).all())


def respond_consent_request(
    session: Session,
    settings: Settings,
    *,
    request_id: UUID,
    operator_id: UUID,
    approve: bool,
) -> ConsentRequest | None:
    req = session.get(ConsentRequest, request_id)
    if req is None or req.operator_id != operator_id:
        return None
    now = _utcnow()
    if req.status != "pending":
        return None
    if req.expires_at < now:
        req.status = "expired"
        req.updated_at = now
        session.add(req)
        _audit(session, req.id, "expired", "on_respond")
        session.commit()
        return req

    if not approve:
        req.status = "denied"
        req.updated_at = now
        session.add(req)
        _audit(session, req.id, "denied", None)
        session.commit()
        return req

    token = secrets.token_urlsafe(24)
    ttl = timedelta(minutes=max(5, settings.disclosure_token_ttl_minutes))
    req.status = "approved"
    req.disclosure_token = token
    req.disclosure_token_expires_at = now + ttl
    req.updated_at = now
    session.add(req)
    _audit(session, req.id, "approved", None)
    session.commit()
    session.refresh(req)
    logger.info("consent.approved request_id=%s", request_id)
    return req


def validate_disclosure_token(session: Session, operator_id: UUID, token: str) -> bool:
    if not token:
        return False
    now = _utcnow()
    stmt = (
        select(ConsentRequest)
        .where(ConsentRequest.operator_id == operator_id)
        .where(ConsentRequest.status == "approved")
        .where(ConsentRequest.disclosure_token == token)
    )
    req = session.exec(stmt).first()
    if req is None:
        return False
    if req.disclosure_token_expires_at and req.disclosure_token_expires_at < now:
        return False
    return True
