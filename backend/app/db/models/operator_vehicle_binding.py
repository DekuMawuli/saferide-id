"""Links an operator to a vehicle for a validity window."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class OperatorVehicleBinding(SQLModel, table=True):
    __tablename__: ClassVar[str] = "operator_vehicle_bindings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    operator_id: UUID = Field(foreign_key="operators.id", index=True)
    vehicle_id: UUID = Field(foreign_key="vehicles.id", index=True)

    valid_from: datetime | None = Field(default=None)
    valid_until: datetime | None = Field(default=None)
    is_active: bool = Field(default=True)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
