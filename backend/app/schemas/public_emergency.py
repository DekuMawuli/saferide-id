"""Public panic / report bodies (no auth)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class EmergencyShareCreate(BaseModel):
    verify_short_code: str = Field(min_length=4, max_length=16)
    sender_msisdn: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=1024)


class PublicReportCreate(BaseModel):
    operator_code: str | None = Field(default=None, max_length=32)
    incident_type: str = Field(max_length=64)
    details: str = Field(max_length=8000)
    location: str | None = Field(default=None, max_length=512)
    contact: str | None = Field(default=None, max_length=256)


class SimSmsSendBody(BaseModel):
    to_address: str = Field(max_length=64)
    body: str = Field(max_length=4096)
    tag: str = Field(default="manual", max_length=64)


class UssdSimTurnBody(BaseModel):
    msisdn: str = Field(default="+255700000000", max_length=32)
    session_id: str | None = Field(default=None, max_length=64)
    input: str = Field(default="", max_length=180, description="User key / text for this step")
