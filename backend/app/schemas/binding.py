"""Operator–vehicle binding API models."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OperatorVehicleBindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    operator_id: UUID
    vehicle_id: UUID
    valid_from: datetime | None
    valid_until: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class OperatorVehicleBindingCreate(BaseModel):
    vehicle_id: UUID


class OperatorVehicleBindingListItem(BaseModel):
    """Binding plus vehicle fields for driver / officer UIs."""

    binding: OperatorVehicleBindingRead
    plate: str | None = None
    vehicle_display_name: str | None = None
