from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CorporateBodyCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class CorporateBodyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime
