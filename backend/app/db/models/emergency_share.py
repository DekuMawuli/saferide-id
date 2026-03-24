"""Panic / emergency share events (public trigger, simulated SMS to configured recipients)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EmergencyShare(SQLModel, table=True):
    __tablename__: ClassVar[str] = "emergency_shares"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    operator_id: UUID | None = Field(default=None, index=True)
    verify_short_code: str | None = Field(default=None, max_length=16)
    sender_msisdn: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=1024)
    trust_summary: str | None = Field(default=None, max_length=2048)
    sms_sent_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)
