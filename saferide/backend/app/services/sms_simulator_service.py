"""Persist simulated SMS rows (lab visibility — not a carrier integration)."""

from __future__ import annotations

import logging

from sqlmodel import Session, select

from app.db.models.sim_sms import SimSmsMessage

logger = logging.getLogger(__name__)


def _to_address_variants(address: str) -> list[str]:
    """Match stored rows when MSISDN is entered with or without leading +."""
    t = (address or "").strip().replace(" ", "")
    if not t:
        return []
    out: list[str] = [t]
    if t.startswith("+"):
        out.append(t[1:])
    else:
        out.append(f"+{t}")
    return list(dict.fromkeys(out))


def log_sim_sms(session: Session, *, to_address: str, body: str, tag: str = "general") -> SimSmsMessage:
    row = SimSmsMessage(to_address=to_address.strip(), body=body, tag=tag)
    session.add(row)
    session.commit()
    session.refresh(row)
    logger.info("sim_sms tag=%s to=%s id=%s", tag, to_address[:16], row.id)
    return row


def list_sim_sms(
    session: Session,
    *,
    limit: int = 100,
    to_address: str | None = None,
) -> list[SimSmsMessage]:
    stmt = select(SimSmsMessage).order_by(SimSmsMessage.created_at.desc()).limit(min(limit, 500))
    if to_address:
        variants = _to_address_variants(to_address)
        if variants:
            stmt = stmt.where(SimSmsMessage.to_address.in_(variants))
    return list(session.exec(stmt).all())
