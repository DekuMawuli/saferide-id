"""Simulated SMS outbox (lab / demo — not a real SMS gateway)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SimSmsMessage(SQLModel, table=True):
    __tablename__: ClassVar[str] = "sim_sms_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    to_address: str = Field(max_length=64, index=True)
    body: str = Field(max_length=4096)
    tag: str = Field(default="general", max_length=64, description="panic|report|consent|ussd|manual|...")
    created_at: datetime = Field(default_factory=_utcnow)
