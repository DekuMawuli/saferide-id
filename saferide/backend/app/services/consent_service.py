"""Consent requests and disclosure tokens."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode
from uuid import UUID

from sqlmodel import Session, select

from app.core.config import Settings
from app.core.trust_status import normalize_operator_status, trust_band_for_status
from app.db.models.consent_request import ConsentAuditEntry, ConsentRequest
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.ride_event import RideEvent
from app.db.models.vehicle import Vehicle
from app.services.operator_lookup import get_operator_by_verify_short_code
from app.services.sms_simulator_service import log_sim_sms

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    # Return naive UTC — SQLite strips tzinfo on write, so comparisons must use naive datetimes.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(session: Session, request_id: UUID, action: str, detail: str | None = None) -> None:
    session.add(
        ConsentAuditEntry(consent_request_id=request_id, action=action, detail=detail)
    )


def _notify_driver(
    session: Session,
    op: Operator,
    req: ConsentRequest,
) -> None:
    """Send a simulated SMS to the driver so they know a consent request is waiting."""
    if not op.phone:
        return
    channel_label = (req.channel or "web").upper()
    passenger = req.passenger_msisdn or "a passenger"
    ttl_mins = int((req.expires_at - _utcnow()).total_seconds() // 60)
    body = (
        f"SAFERIDE: {passenger} ({channel_label}) is requesting your details.\n"
        f"Log in to approve or deny within {ttl_mins} min.\n"
        f"Ref: {str(req.id)[:8]}"
    )
    log_sim_sms(session, to_address=op.phone, body=body, tag="consent_request")


def _frontend_origin(settings: Settings) -> str:
    return (settings.frontend_app_url or "").strip().rstrip("/")


def _build_passenger_links(
    settings: Settings,
    *,
    verify_short_code: str | None,
    disclosure_token: str | None,
) -> tuple[str | None, str | None]:
    origin = _frontend_origin(settings)
    code = (verify_short_code or "").strip().upper()
    token = (disclosure_token or "").strip()
    if not origin or not code or not token:
        return None, None

    encoded_code = quote(code, safe="")
    query = urlencode({"disclosure_token": token})
    basic_url = f"{origin}/verify/basic/{encoded_code}?{query}"
    full_url = f"{origin}/verify/result/{encoded_code}?{query}"
    return basic_url, full_url


def _active_vehicle_plate(session: Session, operator_id: UUID) -> str | None:
    stmt = (
        select(Vehicle.external_ref)
        .join(OperatorVehicleBinding, OperatorVehicleBinding.vehicle_id == Vehicle.id)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.is_active == True)  # noqa: E712
        .limit(1)
    )
    return session.exec(stmt).first()


def build_passenger_approval_message(
    session: Session,
    settings: Settings,
    op: Operator,
    req: ConsentRequest,
) -> str:
    name = op.full_name or "Driver"
    code = (op.verify_short_code or req.verify_short_code or "—").strip().upper()
    status = normalize_operator_status(op.status)
    band = trust_band_for_status(status)
    plate = _active_vehicle_plate(session, op.id)

    basic_url, full_url = _build_passenger_links(
        settings,
        verify_short_code=code,
        disclosure_token=req.disclosure_token,
    )

    # Header — visible on feature phones without clicking the link
    lines = [
        f"SAFERIDE: {name} approved your request.",
        f"Trust: {band} | Status: {status}",
        f"Vehicle: {plate or 'not on file'}",
        f"Code: {code}",
    ]
    # Links — basic works on any browser; full adds photo/VC for smartphones
    if basic_url:
        lines.append(f"View: {basic_url}")
    if full_url:
        lines.append(f"Full: {full_url}")
    if not basic_url and not full_url and req.disclosure_token:
        lines.append(f"Token: {req.disclosure_token}")
    return "\n".join(lines)


def _notify_passenger(
    session: Session,
    settings: Settings,
    op: Operator,
    req: ConsentRequest,
    *,
    approved: bool,
) -> None:
    """Send a simulated SMS to the passenger with the outcome."""
    if not req.passenger_msisdn:
        return
    if approved:
        body = build_passenger_approval_message(session, settings, op, req)
    else:
        body = "SAFERIDE: The driver has declined your request for more details."
    log_sim_sms(session, to_address=req.passenger_msisdn, body=body, tag="consent_response")


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
    _notify_driver(session, op, req)
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

    op = session.get(Operator, operator_id)

    if not approve:
        req.status = "denied"
        req.updated_at = now
        session.add(req)
        _audit(session, req.id, "denied", None)
        session.commit()
        if op:
            _notify_passenger(session, settings, op, req, approved=False)
        return req

    token = secrets.token_urlsafe(24)
    ttl = timedelta(minutes=max(5, settings.disclosure_token_ttl_minutes))
    req.status = "approved"
    req.disclosure_token = token
    req.disclosure_token_expires_at = now + ttl
    req.updated_at = now
    session.add(req)
    _audit(session, req.id, "approved", None)
    session.add(
        RideEvent(
            operator_id=operator_id,
            verify_short_code=req.verify_short_code,
            channel=req.channel,
            passenger_msisdn=req.passenger_msisdn,
            event_type="consent_approved",
            consent_request_id=req.id,
            recorded_at=now,
        )
    )
    session.commit()
    session.refresh(req)
    if op:
        _notify_passenger(session, settings, op, req, approved=True)
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
