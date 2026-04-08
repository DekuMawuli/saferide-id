"""Ride/trip event log — one row per meaningful pickup interaction."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RideEvent(SQLModel, table=True):
    __tablename__: ClassVar[str] = "ride_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # The driver whose code was used
    operator_id: UUID = Field(foreign_key="operators.id", index=True)
    # The short-code that was looked up
    verify_short_code: str = Field(max_length=16, index=True)
    # Channel that originated the event (WEB / USSD / SMS)
    channel: str = Field(max_length=32, default="WEB")
    # Passenger identifier (MSISDN for USSD/SMS, null for anonymous web scan)
    passenger_msisdn: str | None = Field(default=None, max_length=32)
    # Event type: consent_approved | trust_verified
    event_type: str = Field(max_length=64, default="consent_approved")
    # FK back to the consent request if this event was triggered by one
    consent_request_id: UUID | None = Field(default=None, index=True)
    recorded_at: datetime = Field(default_factory=_utcnow)
