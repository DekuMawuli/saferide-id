"""Vehicle registry (governance)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.auth import require_governance_operator, require_governance_read_operator
from app.core.rbac import normalize_operator_role
from app.db.models.corporate_body import CorporateBody
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.db.session import get_session
from app.schemas.vehicle import BoundOperatorSummary, VehicleCreate, VehicleListItem, VehicleRead, VehicleUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> VehicleRead:
    role = normalize_operator_role(actor.role)
    corporate_body_id = body.corporate_body_id
    if role == "officer":
        if actor.corporate_body_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Officer account must be attached to a corporate body to register vehicles",
            )
        corporate_body_id = actor.corporate_body_id
    elif corporate_body_id is not None:
        if role not in ("admin", "system_admin"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Only platform admins can assign a corporate body explicitly",
            )
        cb = session.get(CorporateBody, corporate_body_id)
        if cb is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Corporate body not found")

    v = Vehicle(
        external_ref=body.plate.strip(),
        display_name=(body.display_name.strip() if body.display_name else None) or None,
        vehicle_type=(body.vehicle_type.strip() if body.vehicle_type else None) or None,
        make_model=(body.make_model.strip() if body.make_model else None) or None,
        color=(body.color.strip() if body.color else None) or None,
        corporate_body_id=corporate_body_id,
    )
    session.add(v)
    session.commit()
    session.refresh(v)
    logger.info("vehicles.create id=%s plate=%s corp=%s", v.id, v.external_ref, corporate_body_id)
    return VehicleRead.model_validate(v)


@router.get("", response_model=list[VehicleListItem])
def list_vehicles(
    _actor: Annotated[Operator, Depends(require_governance_read_operator)],
    session: Annotated[Session, Depends(get_session)],
    limit: int = 200,
) -> list[VehicleListItem]:
    stmt = select(Vehicle).order_by(Vehicle.created_at.desc()).limit(min(limit, 500))
    vehicles = list(session.exec(stmt).all())

    # For each vehicle, find its active binding + operator in one query per vehicle.
    result: list[VehicleListItem] = []
    for v in vehicles:
        bind_stmt = (
            select(OperatorVehicleBinding, Operator)
            .join(Operator, OperatorVehicleBinding.operator_id == Operator.id)
            .where(OperatorVehicleBinding.vehicle_id == v.id)
            .where(OperatorVehicleBinding.is_active == True)  # noqa: E712
            .limit(1)
        )
        row = session.exec(bind_stmt).first()
        bound: BoundOperatorSummary | None = None
        if row:
            binding, op = row
            bound = BoundOperatorSummary(
                id=op.id,
                full_name=op.full_name,
                phone=op.phone,
                status=op.status,
                verify_short_code=op.verify_short_code,
                binding_id=binding.id,
                is_active=binding.is_active,
            )
        corp_name: str | None = None
        if v.corporate_body_id is not None:
            cb = session.get(CorporateBody, v.corporate_body_id)
            if cb is not None:
                corp_name = cb.name
        result.append(
            VehicleListItem(
                vehicle=VehicleRead.model_validate(v),
                bound_operator=bound,
                corporate_body_name=corp_name,
            )
        )
    return result


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(
    vehicle_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_read_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> VehicleRead:
    v = session.get(Vehicle, vehicle_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return VehicleRead.model_validate(v)


def _can_edit_vehicle(actor: Operator, v: Vehicle) -> None:
    """Officers may only edit vehicles in their corporate body."""
    role = normalize_operator_role(actor.role)
    if role in ("admin", "system_admin", "monitor", "support"):
        return
    if role == "officer":
        if actor.corporate_body_id is None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Officer account must be linked to an association",
            )
        # Allow legacy rows with null corporate body so officers can claim/fix them.
        if v.corporate_body_id is not None and v.corporate_body_id != actor.corporate_body_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Not allowed to edit vehicles outside your association",
            )
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed to edit vehicles")


@router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(
    vehicle_id: UUID,
    body: VehicleUpdate,
    actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> VehicleRead:
    v = session.get(Vehicle, vehicle_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    _can_edit_vehicle(actor, v)

    role = normalize_operator_role(actor.role)
    data = body.model_dump(exclude_unset=True)

    if "corporate_body_id" in data:
        if role not in ("admin", "system_admin"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Only platform admins can change vehicle association",
            )
        new_corp = data["corporate_body_id"]
        if new_corp is not None:
            cb = session.get(CorporateBody, new_corp)
            if cb is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Corporate body not found")
        v.corporate_body_id = new_corp
    elif role == "officer" and v.corporate_body_id is None and actor.corporate_body_id is not None:
        # Backfill association ownership for legacy vehicles on first officer edit.
        v.corporate_body_id = actor.corporate_body_id

    if "plate" in data and data["plate"] is not None:
        v.external_ref = data["plate"].strip()
    if "display_name" in data:
        raw = data["display_name"]
        v.display_name = (raw.strip() if raw else None) or None
    if "vehicle_type" in data:
        raw = data["vehicle_type"]
        v.vehicle_type = (raw.strip() if raw else None) or None
    if "make_model" in data:
        raw = data["make_model"]
        v.make_model = (raw.strip() if raw else None) or None
    if "color" in data:
        raw = data["color"]
        v.color = (raw.strip() if raw else None) or None

    v.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(v)
    session.commit()
    session.refresh(v)
    logger.info("vehicles.update id=%s", v.id)
    return VehicleRead.model_validate(v)
