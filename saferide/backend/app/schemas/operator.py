"""Operator API models (Pydantic)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OperatorRead(BaseModel):
    """Public operator profile returned after onboarding / auth."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_subject_id: str = Field(description="OIDC subject from eSignet")
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    photo_ref: str | None = None
    individual_id: str | None = None
    gender: str | None = None
    birthdate: str | None = None
    registration_type: str | None = None
    auth_provider: str
    acr: str | None = Field(default=None, description="Assurance / ACR from IdP when present")
    esignet_verified_at: datetime | None = None
    status: str
    verify_short_code: str | None = Field(
        default=None,
        description="Passenger lookup code when operator is approved/active",
    )
    role: str = Field(description="passenger | driver | officer | admin")
    corporate_body_id: UUID | None = None
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


class OperatorGovernanceUpdate(BaseModel):
    """Partial update for governance UI (name / email). At least one field required."""

    full_name: str | None = None
    email: str | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> OperatorGovernanceUpdate:
        if self.full_name is None and self.email is None:
            raise ValueError("Provide at least one of full_name or email")
        return self
