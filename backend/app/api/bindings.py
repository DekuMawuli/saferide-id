"""Operator–vehicle binding updates (governance)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.api.auth import require_governance_operator
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.session import get_session
from app.schemas.binding import OperatorVehicleBindingRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bindings", tags=["bindings"])


class BindingActiveUpdate(BaseModel):
    is_active: bool = Field(description="Set false to unbind")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.patch("/{binding_id}", response_model=OperatorVehicleBindingRead)
def update_binding_active(
    binding_id: UUID,
    body: BindingActiveUpdate,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorVehicleBindingRead:
    b = session.get(OperatorVehicleBinding, binding_id)
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Binding not found")
    b.is_active = body.is_active
    b.updated_at = _utcnow()
    session.add(b)
    session.commit()
    session.refresh(b)
    logger.info("bindings.update binding_id=%s is_active=%s", binding_id, body.is_active)
    return OperatorVehicleBindingRead.model_validate(b)
