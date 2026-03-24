"""Operator API models (Pydantic)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OperatorRead(BaseModel):
    """Public operator profile returned after onboarding / auth."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_subject_id: str = Field(description="OIDC subject from eSignet")
    full_name: str | None = None
    phone: str | None = None
    photo_ref: str | None = None
    auth_provider: str
    acr: str | None = Field(default=None, description="Assurance / ACR from IdP when present")
    esignet_verified_at: datetime | None = None
    status: str
    verify_short_code: str | None = Field(
        default=None,
        description="Passenger lookup code when operator is approved/active",
    )
    role: str = Field(description="passenger | driver | officer | admin")
    created_at: datetime
    updated_at: datetime


class OperatorListItem(BaseModel):
    """Directory row for officer/admin."""

    model_config = ConfigDict(from_attributes=True)

    operator: OperatorRead
    primary_vehicle_plate: str | None = None


class OperatorStatusUpdate(BaseModel):
    status: str = Field(
        description="PENDING | APPROVED | ACTIVE | SUSPENDED | EXPIRED",
        examples=["ACTIVE"],
    )
