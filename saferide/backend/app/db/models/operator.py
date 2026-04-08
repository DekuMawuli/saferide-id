"""Operator persistence (drivers / operators onboarded via eSignet)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlalchemy import Text
from sqlmodel import Column, Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Operator(SQLModel, table=True):
    __tablename__: ClassVar[str] = "operators"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    external_subject_id: str = Field(unique=True, index=True, max_length=512)
    full_name: str | None = Field(default=None, max_length=512)
    email: str | None = Field(default=None, max_length=320, index=True)
    password_hash: str | None = Field(
        default=None,
        max_length=512,
        description="Only for local staff/admin login; eSignet users keep this null",
    )
    phone: str | None = Field(default=None, max_length=64)
    photo_ref: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    individual_id: str | None = Field(default=None, max_length=256)
    gender: str | None = Field(default=None, max_length=32)
    birthdate: str | None = Field(default=None, max_length=32)
    registration_type: str | None = Field(default=None, max_length=128)

    auth_provider: str = Field(default="esignet", max_length=64)
    acr: str | None = Field(default=None, max_length=256)

    esignet_verified_at: datetime | None = Field(default=None)
    esignet_last_access_token: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    esignet_token_expires_at: datetime | None = Field(default=None)
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
    corporate_body_id: UUID | None = Field(default=None, foreign_key="corporate_bodies.id", index=True)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
