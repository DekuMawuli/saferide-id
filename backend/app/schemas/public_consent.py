"""Consent request payloads."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConsentRequestCreate(BaseModel):
    verify_short_code: str = Field(min_length=4, max_length=16)
    channel: str = Field(default="web", max_length=32)
    passenger_msisdn: str | None = Field(default=None, max_length=32)


class ConsentRequestCreateResponse(BaseModel):
    request_id: UUID
    expires_at: str
    poll_url_hint: str


class ConsentRespondBody(BaseModel):
    approve: bool = Field(description="True to issue a short-lived disclosure token")


class ConsentRequestItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    operator_id: UUID
    status: str
    channel: str
    verify_short_code: str
    passenger_msisdn: str | None
    expires_at: datetime
    created_at: datetime
