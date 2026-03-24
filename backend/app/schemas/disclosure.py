"""Trust disclosure tiers (Milestone 3)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class TrustVehicleItem(BaseModel):
    plate: str | None = None
    display_name: str | None = None


class TrustPublicResponse(BaseModel):
    """
    Unified shape; fields omitted or null per `disclosure_tier`.

    - minimal: USSD / low bandwidth — masked name, no photo, no phone, no operator_id
    - standard: web default — photo, operator_id, full name
    - extended: after operator consent — adds phone, verified timestamp, masked subject
    """

    disclosure_tier: str = Field(description="minimal | standard | extended")
    trust_band: str
    status: str
    display_name: str | None = None
    operator_id: UUID | None = None
    photo_url: str | None = None
    phone: str | None = None
    vehicles: list[TrustVehicleItem] = Field(default_factory=list)
    esignet_verified_at: str | None = Field(
        default=None,
        description="ISO8601 when present (extended tier)",
    )
    external_subject_hint: str | None = Field(
        default=None,
        description="Masked OIDC subject (extended tier)",
    )
    consent_request_id: UUID | None = Field(
        default=None,
        description="Set when passenger should poll for extended disclosure",
    )
