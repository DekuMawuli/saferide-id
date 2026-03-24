"""Vehicle registry (governance)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.auth import require_governance_operator
from app.db.models.operator import Operator
from app.db.models.vehicle import Vehicle
from app.db.session import get_session
from app.schemas.vehicle import VehicleCreate, VehicleRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> VehicleRead:
    v = Vehicle(
        external_ref=body.plate.strip(),
        display_name=body.display_name.strip() if body.display_name else None,
    )
    session.add(v)
    session.commit()
    session.refresh(v)
    logger.info("vehicles.create id=%s plate=%s", v.id, v.external_ref)
    return VehicleRead.model_validate(v)


@router.get("", response_model=list[VehicleRead])
def list_vehicles(
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
    limit: int = 200,
) -> list[VehicleRead]:
    stmt = select(Vehicle).order_by(Vehicle.created_at.desc()).limit(min(limit, 500))
    rows = session.exec(stmt).all()
    return [VehicleRead.model_validate(v) for v in rows]


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(
    vehicle_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> VehicleRead:
    v = session.get(Vehicle, vehicle_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return VehicleRead.model_validate(v)
