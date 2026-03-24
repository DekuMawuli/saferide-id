"""Issued verifiable credential records (Inji Certify and future issuers)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Credential(SQLModel, table=True):
    __tablename__: ClassVar[str] = "credentials"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    operator_id: UUID = Field(foreign_key="operators.id", index=True)
    vehicle_id: UUID | None = Field(default=None, foreign_key="vehicles.id", index=True)

    credential_type: str = Field(max_length=64, description="e.g. OPERATOR, VEHICLE_BINDING")
    issuer: str = Field(max_length=512)
    external_credential_id: str | None = Field(default=None, max_length=512)
    template_name: str | None = Field(default=None, max_length=256)

    status: str = Field(default="PENDING", max_length=32)
    issued_at: datetime | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)

    raw_reference: str | None = Field(default=None, max_length=2048)
    metadata_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
