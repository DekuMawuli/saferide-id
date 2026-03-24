"""Unique short codes for public passenger verification."""

from __future__ import annotations

import secrets

from sqlmodel import Session, select

from app.db.models.operator import Operator

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LEN = 8


def _random_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LEN))


def assign_unique_verify_short_code(session: Session, op: Operator) -> str:
    """Set `verify_short_code` on operator if missing; return the code (existing or new)."""
    if op.verify_short_code:
        return op.verify_short_code
    for _ in range(40):
        candidate = _random_code()
        stmt = select(Operator).where(Operator.verify_short_code == candidate)
        if session.exec(stmt).first() is None:
            op.verify_short_code = candidate
            session.add(op)
            session.commit()
            session.refresh(op)
            return candidate
    raise RuntimeError("Could not allocate a unique verify_short_code")
