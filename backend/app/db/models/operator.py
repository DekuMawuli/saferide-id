"""Operator persistence (drivers / operators onboarded via eSignet)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Operator(SQLModel, table=True):
    __tablename__: ClassVar[str] = "operators"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    external_subject_id: str = Field(unique=True, index=True, max_length=512)
    full_name: str | None = Field(default=None, max_length=512)
    phone: str | None = Field(default=None, max_length=64)
    photo_ref: str | None = Field(default=None, max_length=2048)

    auth_provider: str = Field(default="esignet", max_length=64)
    acr: str | None = Field(default=None, max_length=256)

    esignet_verified_at: datetime | None = Field(default=None)
    status: str = Field(default="PENDING", max_length=32)
    verify_short_code: str | None = Field(
        default=None,
        unique=True,
        index=True,
        max_length=16,
        description="Public lookup code for passenger verification (assigned when approved/active)",
    )
    role: str = Field(
        default="driver",
        max_length=32,
        description="RBAC role: passenger | driver | officer | admin",
    )

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
