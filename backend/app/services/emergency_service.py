"""Panic share: log event + simulated SMS to configured recipients."""

from __future__ import annotations

import logging
from sqlmodel import Session

from app.core.config import Settings
from app.db.models.emergency_share import EmergencyShare
from app.services.operator_lookup import get_operator_by_verify_short_code
from app.services.public_trust_service import get_trust_public
from app.services.sms_simulator_service import log_sim_sms

logger = logging.getLogger(__name__)


def _format_minimal_trust_text(code: str, session: Session) -> str:
    t = get_trust_public(session, code, tier="minimal")
    if t is None:
        return f"Unknown code {code}"
    plates = ", ".join(filter(None, [v.plate or v.display_name for v in t.vehicles])) or "no vehicle"
    name = t.display_name or "unknown"
    return f"{name} | {t.status} | {plates} | band={t.trust_band}"


def create_emergency_share(
    session: Session,
    settings: Settings,
    *,
    verify_short_code: str,
    sender_msisdn: str | None,
    note: str | None,
) -> EmergencyShare | None:
    raw = (verify_short_code or "").strip().upper()
    if not raw:
        return None
    op = get_operator_by_verify_short_code(session, raw)
    summary = _format_minimal_trust_text(raw, session)
    body_lines = [
        "[SafeRide PANIC]",
        f"Code: {raw}",
        f"Trust: {summary}",
    ]
    if sender_msisdn:
        body_lines.append(f"From: {sender_msisdn}")
    if note:
        body_lines.append(f"Note: {note[:200]}")
    body = "\n".join(body_lines)

    recipients = settings.sim_emergency_sms_recipients_list()
    sent = 0
    for dest in recipients:
        log_sim_sms(session, to_address=dest, body=body, tag="panic")
        sent += 1

    row = EmergencyShare(
        operator_id=op.id if op else None,
        verify_short_code=raw,
        sender_msisdn=sender_msisdn,
        note=note,
        trust_summary=summary,
        sms_sent_count=sent,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    logger.info("emergency.share id=%s sms=%s", row.id, sent)
    return row


def format_share_public(row: EmergencyShare) -> dict:
    return {
        "share_id": str(row.id),
        "verify_short_code": row.verify_short_code,
        "sms_simulated_count": row.sms_sent_count,
        "created_at": row.created_at.isoformat(),
    }
