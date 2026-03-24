"""Shared operator lookup helpers."""

from __future__ import annotations

from sqlmodel import Session, select

from app.db.models.operator import Operator


def get_operator_by_verify_short_code(session: Session, code: str) -> Operator | None:
    raw = (code or "").strip().upper()
    if not raw:
        return None
    stmt = select(Operator).where(Operator.verify_short_code == raw)
    return session.exec(stmt).first()
