"""Passenger incident reports (no auth — same pattern as real tip line)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PublicIncidentReport(SQLModel, table=True):
    __tablename__: ClassVar[str] = "public_incident_reports"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    operator_code: str | None = Field(default=None, max_length=32)
    incident_type: str = Field(max_length=64)
    details: str = Field(max_length=8000)
    location: str | None = Field(default=None, max_length=512)
    contact: str | None = Field(default=None, max_length=256)
    created_at: datetime = Field(default_factory=_utcnow)
