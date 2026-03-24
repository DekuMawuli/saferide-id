"""Passenger-initiated disclosure consent (operator approves via authenticated app)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConsentRequest(SQLModel, table=True):
    __tablename__: ClassVar[str] = "consent_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    operator_id: UUID = Field(foreign_key="operators.id", index=True)
    status: str = Field(default="pending", max_length=32)  # pending|approved|denied|expired
    channel: str = Field(default="web", max_length=32)
    passenger_msisdn: str | None = Field(default=None, max_length=32)
    verify_short_code: str = Field(max_length=16, index=True)
    disclosure_token: str | None = Field(default=None, max_length=64, index=True)
    disclosure_token_expires_at: datetime | None = Field(default=None)
    expires_at: datetime = Field(description="Request must be answered before this time")
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ConsentAuditEntry(SQLModel, table=True):
    __tablename__: ClassVar[str] = "consent_audit_entries"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    consent_request_id: UUID = Field(index=True)
    action: str = Field(max_length=64)
    detail: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=_utcnow)
