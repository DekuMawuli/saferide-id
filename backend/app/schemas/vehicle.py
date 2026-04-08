"""Vehicle API models."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    plate: str = Field(min_length=1, max_length=256, description="License plate or fleet id")
    display_name: str | None = Field(default=None, max_length=512)
    vehicle_type: str | None = Field(default=None, max_length=64)
    make_model: str | None = Field(default=None, max_length=256)
    color: str | None = Field(default=None, max_length=64)
    corporate_body_id: UUID | None = Field(
        default=None,
        description="Platform admins only; officers use their own association",
    )


class VehicleUpdate(BaseModel):
    """Partial update; only sent fields are applied."""

    plate: str | None = Field(default=None, min_length=1, max_length=256)
    display_name: str | None = Field(default=None, max_length=512)
    vehicle_type: str | None = Field(default=None, max_length=64)
    make_model: str | None = Field(default=None, max_length=256)
    color: str | None = Field(default=None, max_length=64)
    corporate_body_id: UUID | None = Field(
        default=None,
        description="Platform admins only; officers cannot reassign association",
    )


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_ref: str | None
    display_name: str | None
    vehicle_type: str | None = None
    make_model: str | None = None
    color: str | None = None
    corporate_body_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class BoundOperatorSummary(BaseModel):
    id: UUID
    full_name: str | None
    phone: str | None
    status: str
    verify_short_code: str | None
    binding_id: UUID
    is_active: bool


class VehicleListItem(BaseModel):
    """Vehicle with its current active binding and operator (if any)."""
    vehicle: VehicleRead
    bound_operator: BoundOperatorSummary | None = None
    corporate_body_name: str | None = None
