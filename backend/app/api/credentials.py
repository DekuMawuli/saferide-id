"""HTTP API for verifiable credential issuance (Inji Certify)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.schemas.credential import CredentialIssueResponse, CredentialRead
from app.services.credential_service import (
    CredentialIssuanceError,
    get_credential,
    issue_operator_credential,
    issue_vehicle_binding_credential,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credentials", tags=["credentials"])


def get_settings_dep() -> Settings:
    return get_settings()


@router.post(
    "/issue/operator/{operator_id}",
    response_model=CredentialIssueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_operator_vc(
    operator_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> CredentialIssueResponse:
    """Issue an operator credential via Inji Certify after business-rule checks."""
    logger.info("credentials.issue.operator operator_id=%s", operator_id)
    try:
        row = await issue_operator_credential(session, operator_id, settings)
    except CredentialIssuanceError as exc:
        raise HTTPException(exc.status_code, detail=exc.message) from exc
    return CredentialIssueResponse(
        credential=CredentialRead.model_validate(row),
    )


@router.post(
    "/issue/vehicle/{operator_id}/{vehicle_id}",
    response_model=CredentialIssueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_vehicle_binding_vc(
    operator_id: UUID,
    vehicle_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> CredentialIssueResponse:
    """Issue a credential for an active operator–vehicle binding."""
    logger.info(
        "credentials.issue.vehicle operator_id=%s vehicle_id=%s",
        operator_id,
        vehicle_id,
    )
    try:
        row = await issue_vehicle_binding_credential(
            session, operator_id, vehicle_id, settings
        )
    except CredentialIssuanceError as exc:
        raise HTTPException(exc.status_code, detail=exc.message) from exc
    return CredentialIssueResponse(
        credential=CredentialRead.model_validate(row),
    )


@router.get("/{credential_id}", response_model=CredentialRead)
def read_credential(
    credential_id: UUID,
    session: Annotated[Session, Depends(get_session)],
) -> CredentialRead:
    """Fetch a persisted credential record by id."""
    row = get_credential(session, credential_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Credential not found")
    logger.debug("credentials.get credential_id=%s", credential_id)
    return CredentialRead.model_validate(row)
