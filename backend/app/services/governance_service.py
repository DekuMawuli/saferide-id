"""Officer/admin operator and fleet governance."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.core.trust_status import (
    OPERATOR_STATUSES,
    normalize_operator_status,
    STATUS_ACTIVE,
    STATUS_APPROVED,
)
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.services.verify_code_service import assign_unique_verify_short_code

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class GovernanceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def set_operator_trust_status(session: Session, operator_id: UUID, new_status: str) -> Operator:
    """Update operator.status; allocate verify_short_code when entering APPROVED/ACTIVE."""
    ns = normalize_operator_status(new_status)
    if ns not in OPERATOR_STATUSES:
        raise GovernanceError(f"Invalid status {new_status!r}", status_code=400)
    op = session.get(Operator, operator_id)
    if op is None:
        raise GovernanceError("Operator not found", status_code=404)
    if op.role == "passenger" and ns in (STATUS_ACTIVE, STATUS_APPROVED) and op.esignet_verified_at is None:
        raise GovernanceError(
            "Passenger must complete eSignet verification before APPROVED/ACTIVE status",
            status_code=400,
        )
    op.status = ns
    op.updated_at = _utcnow()
    session.add(op)
    session.commit()
    session.refresh(op)
    if ns in (STATUS_ACTIVE, STATUS_APPROVED):
        assign_unique_verify_short_code(session, op)
        session.refresh(op)
    logger.info("governance: operator_id=%s status -> %s", operator_id, ns)
    return op


def list_operators_with_vehicle_hint(
    session: Session,
    *,
    status: str | None = None,
    q: str | None = None,
    limit: int = 200,
    corporate_body_id: UUID | None = None,
) -> list[tuple[Operator, str | None]]:
    """Return operators with optional primary vehicle plate (first active binding)."""
    stmt = select(Operator).order_by(Operator.created_at.desc()).limit(min(limit, 500))
    if corporate_body_id is not None:
        stmt = stmt.where(Operator.corporate_body_id == corporate_body_id)
    if status:
        stmt = stmt.where(Operator.status == normalize_operator_status(status))
    rows = list(session.exec(stmt).all())
    if q:
        needle = q.strip().lower()
        if needle:
            filtered: list[Operator] = []
            for op in rows:
                blob = " ".join(
                    filter(
                        None,
                        [
                            (op.full_name or "").lower(),
                            (op.phone or "").lower(),
                            (op.verify_short_code or "").lower(),
                            str(op.id).lower(),
                        ],
                    )
                )
                if needle in blob:
                    filtered.append(op)
            rows = filtered

    out: list[tuple[Operator, str | None]] = []
    for op in rows:
        plate: str | None = None
        bstmt = (
            select(OperatorVehicleBinding, Vehicle)
            .join(Vehicle, OperatorVehicleBinding.vehicle_id == Vehicle.id)
            .where(OperatorVehicleBinding.operator_id == op.id)
            .where(OperatorVehicleBinding.is_active == True)  # noqa: E712
        )
        for bind, veh in session.exec(bstmt).all():
            plate = veh.external_ref or veh.display_name
            if plate:
                break
        out.append((op, plate))
    return out
