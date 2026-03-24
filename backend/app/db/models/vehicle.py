"""Fleet / vehicle identity (minimal scaffold for VC binding)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Vehicle(SQLModel, table=True):
    __tablename__: ClassVar[str] = "vehicles"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    external_ref: str | None = Field(
        default=None,
        max_length=256,
        description="Fleet or external system identifier (VIN, plate, internal id)",
    )
    display_name: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
