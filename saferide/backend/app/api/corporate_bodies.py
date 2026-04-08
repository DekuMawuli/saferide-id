from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.auth import get_current_operator
from app.core.rbac import normalize_operator_role
from app.db.models.corporate_body import CorporateBody
from app.db.models.operator import Operator
from app.db.session import get_session
from app.schemas.corporate import CorporateBodyCreate, CorporateBodyRead
from app.schemas.operator import OperatorRead

router = APIRouter(prefix="/corporate-bodies", tags=["corporate-bodies"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_adminish(actor: Operator) -> None:
    role = normalize_operator_role(actor.role)
    if role != "system_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="System admin role required")


@router.get("", response_model=list[CorporateBodyRead])
def list_corporate_bodies(
    _actor: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> list[CorporateBodyRead]:
    rows = list(session.exec(select(CorporateBody).order_by(CorporateBody.created_at.desc())).all())
    return [CorporateBodyRead.model_validate(r) for r in rows]


@router.post("", response_model=CorporateBodyRead, status_code=status.HTTP_201_CREATED)
def create_corporate_body(
    body: CorporateBodyCreate,
    actor: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> CorporateBodyRead:
    _require_adminish(actor)
    code = (body.code or "").strip().upper() or None
    if code:
        existing = session.exec(select(CorporateBody).where(CorporateBody.code == code)).first()
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Corporate code already exists")
    now = _utcnow()
    row = CorporateBody(
        name=body.name.strip(),
        code=code,
        description=(body.description or "").strip() or None,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return CorporateBodyRead.model_validate(row)


@router.post("/{corporate_id}/officers/{officer_id}", response_model=OperatorRead)
def attach_officer_to_corporate(
    corporate_id: UUID,
    officer_id: UUID,
    actor: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorRead:
    _require_adminish(actor)
    corp = session.get(CorporateBody, corporate_id)
    if corp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Corporate body not found")
    officer = session.get(Operator, officer_id)
    if officer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Officer not found")
    if normalize_operator_role(officer.role) != "officer":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only officer role can be attached")
    officer.corporate_body_id = corporate_id
    officer.updated_at = _utcnow()
    session.add(officer)
    session.commit()
    session.refresh(officer)
    return OperatorRead.model_validate(officer)


@router.get("/{corporate_id}/officers", response_model=list[OperatorRead])
def list_corporate_officers(
    corporate_id: UUID,
    _actor: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
) -> list[OperatorRead]:
    stmt = (
        select(Operator)
        .where(Operator.corporate_body_id == corporate_id)
        .where(Operator.role == "officer")
        .order_by(Operator.created_at.desc())
    )
    rows = list(session.exec(stmt).all())
    return [OperatorRead.model_validate(r) for r in rows]
