"""Vehicle API models."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    plate: str = Field(min_length=1, max_length=256, description="License plate or fleet id")
    display_name: str | None = Field(default=None, max_length=512)


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_ref: str | None
    display_name: str | None
    created_at: datetime
    updated_at: datetime
