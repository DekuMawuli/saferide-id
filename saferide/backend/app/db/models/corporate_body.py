"""Corporate body entity for grouping officers, riders and drivers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CorporateBody(SQLModel, table=True):
    __tablename__: ClassVar[str] = "corporate_bodies"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=256, index=True)
    code: str | None = Field(default=None, max_length=64, unique=True, index=True)
    description: str | None = Field(default=None, max_length=1024)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
