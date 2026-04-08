"""Credential API models (Pydantic)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CredentialClaimLinks(BaseModel):
    """Wallet handoff data derived from SafeRide + Inji runtime config."""

    credential_configuration_id: str
    credential_issuer: str
    issuer_metadata_url: str
    wallet_deep_link: str
    inji_web_url: str | None = None


class CredentialRead(BaseModel):
    """Stored credential row exposed by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    operator_id: UUID
    vehicle_id: UUID | None = None
    credential_type: str
    issuer: str
    external_credential_id: str | None = None
    template_name: str | None = None
    status: str
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    raw_reference: str | None = None
    claim_links: CredentialClaimLinks | None = None
    created_at: datetime
    updated_at: datetime


class CredentialIssueResponse(BaseModel):
    """Response after a successful issuance call."""

    message: str = Field(default="Credential issued")
    credential: CredentialRead


class CredentialIssueErrorDetail(BaseModel):
    """Structured error body (optional use from HTTPException detail)."""

    detail: str
