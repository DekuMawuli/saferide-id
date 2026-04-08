"""Fleet / vehicle identity (minimal scaffold for VC binding)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Vehicle(SQLModel, table=True):
    __tablename__: ClassVar[str] = "vehicles"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    external_ref: str | None = Field(
        default=None,
        max_length=256,
        description="Fleet or external system identifier (VIN, plate, internal id)",
    )
    display_name: str | None = Field(default=None, max_length=512)
    vehicle_type: str | None = Field(
        default=None,
        max_length=64,
        description="e.g. Motorcycle, Matatu, Sedan",
    )
    make_model: str | None = Field(default=None, max_length=256, description="Make and model")
    color: str | None = Field(default=None, max_length=64)
    corporate_body_id: UUID | None = Field(
        default=None,
        foreign_key="corporate_bodies.id",
        index=True,
        description="Association / SACCO that registered this vehicle",
    )
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
