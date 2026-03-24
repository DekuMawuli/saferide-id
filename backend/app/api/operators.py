"""Operator read + governance (trust status, vehicle bindings)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.auth import get_current_operator, require_governance_operator
from app.core.rbac import normalize_operator_role
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.db.session import get_session
from app.schemas.binding import (
    OperatorVehicleBindingCreate,
    OperatorVehicleBindingListItem,
    OperatorVehicleBindingRead,
)
from app.schemas.operator import OperatorListItem, OperatorRead, OperatorStatusUpdate
from app.services.governance_service import GovernanceError, list_operators_with_vehicle_hint, set_operator_trust_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operators", tags=["operators"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_self_or_governance(
    operator_id: UUID,
    current: Operator,
) -> None:
    if current.id == operator_id:
        return
    if normalize_operator_role(current.role) in ("officer", "admin"):
        return
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        detail="Not allowed to view this operator",
    )


@router.get("", response_model=list[OperatorListItem])
def list_operators(
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = 200,
) -> list[OperatorListItem]:
    rows = list_operators_with_vehicle_hint(
        session, status=status_filter, q=q, limit=limit
    )
    return [
        OperatorListItem(
            operator=OperatorRead.model_validate(op),
            primary_vehicle_plate=plate,
        )
        for op, plate in rows
    ]


@router.get("/{operator_id}/vehicle-bindings", response_model=list[OperatorVehicleBindingListItem])
def list_vehicle_bindings(
    operator_id: UUID,
    current: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> list[OperatorVehicleBindingListItem]:
    _require_self_or_governance(operator_id, current)
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    stmt = (
        select(OperatorVehicleBinding, Vehicle)
        .join(Vehicle, OperatorVehicleBinding.vehicle_id == Vehicle.id)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .order_by(OperatorVehicleBinding.created_at.desc())
    )
    out: list[OperatorVehicleBindingListItem] = []
    for bind, veh in session.exec(stmt).all():
        out.append(
            OperatorVehicleBindingListItem(
                binding=OperatorVehicleBindingRead.model_validate(bind),
                plate=veh.external_ref or veh.display_name,
                vehicle_display_name=veh.display_name,
            )
        )
    return out


@router.post(
    "/{operator_id}/vehicle-bindings",
    response_model=OperatorVehicleBindingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_vehicle_binding(
    operator_id: UUID,
    body: OperatorVehicleBindingCreate,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorVehicleBindingRead:
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    veh = session.get(Vehicle, body.vehicle_id)
    if veh is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    stmt = (
        select(OperatorVehicleBinding)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.vehicle_id == body.vehicle_id)
    )
    existing = session.exec(stmt).first()
    if existing:
        existing.is_active = True
        existing.updated_at = _utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return OperatorVehicleBindingRead.model_validate(existing)
    bind = OperatorVehicleBinding(
        operator_id=operator_id,
        vehicle_id=body.vehicle_id,
        is_active=True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(bind)
    session.commit()
    session.refresh(bind)
    logger.info(
        "operators.bind operator_id=%s vehicle_id=%s binding_id=%s",
        operator_id,
        body.vehicle_id,
        bind.id,
    )
    return OperatorVehicleBindingRead.model_validate(bind)


@router.patch("/{operator_id}/status", response_model=OperatorRead)
def patch_operator_status(
    operator_id: UUID,
    body: OperatorStatusUpdate,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    try:
        op = set_operator_trust_status(session, operator_id, body.status)
    except GovernanceError as exc:
        raise HTTPException(exc.status_code, detail=exc.message) from exc
    return OperatorRead.model_validate(op)


@router.get("/{operator_id}", response_model=OperatorRead)
def get_operator(
    operator_id: UUID,
    current: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    _require_self_or_governance(operator_id, current)
    op = session.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operator not found")
    logger.debug("operators.get operator_id=%s", operator_id)
    return OperatorRead.model_validate(op)
