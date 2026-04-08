"""HTTP API for verifiable credential issuance (Inji Certify)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.auth import get_current_operator, require_governance_operator, require_governance_read_operator
from app.core.config import Settings, get_settings
from app.db.models.credential import Credential
from app.db.models.operator import Operator
from app.db.session import get_session
from app.schemas.credential import CredentialClaimLinks, CredentialIssueResponse, CredentialRead
from app.services.credential_service import (
    CredentialIssuanceError,
    get_credential,
    issue_operator_credential,
    issue_vehicle_binding_credential,
)
from app.services.inji_certify_service import InjiCertifyConfigError, InjiCertifyService
from sqlmodel import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credentials", tags=["credentials"])


def get_settings_dep() -> Settings:
    return get_settings()


def _build_claim_links(row: Credential, settings: Settings) -> CredentialClaimLinks | None:
    config_id = (row.template_name or "").strip()
    if not config_id:
        return None
    try:
        inji = InjiCertifyService(settings)
        return CredentialClaimLinks(
            credential_configuration_id=config_id,
            credential_issuer=inji.build_authorization_code_offer(config_id)["credential_issuer"],
            issuer_metadata_url=inji.build_metadata_url(),
            wallet_deep_link=inji.build_wallet_deep_link(config_id),
            inji_web_url=settings.inji_web_base_url.strip() or None,
        )
    except InjiCertifyConfigError:
        return None


def _to_credential_read(row: Credential, settings: Settings) -> CredentialRead:
    payload = CredentialRead.model_validate(row).model_dump()
    payload["claim_links"] = _build_claim_links(row, settings)
    return CredentialRead(**payload)


@router.post(
    "/issue/operator/{operator_id}",
    response_model=CredentialIssueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_operator_vc(
    operator_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
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
        credential=_to_credential_read(row, settings),
    )


@router.post(
    "/issue/vehicle/{operator_id}/{vehicle_id}",
    response_model=CredentialIssueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_vehicle_binding_vc(
    operator_id: UUID,
    vehicle_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_operator)],
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
        credential=_to_credential_read(row, settings),
    )


@router.get("/my", response_model=list[CredentialRead])
def list_my_credentials(
    actor: Annotated[Operator, Depends(get_current_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> list[CredentialRead]:
    """Return all credentials issued to the currently authenticated operator."""
    stmt = (
        select(Credential)
        .where(Credential.operator_id == actor.id)
        .order_by(Credential.created_at.desc())
    )
    rows = list(session.exec(stmt).all())
    return [_to_credential_read(r, settings) for r in rows]


@router.get("/{credential_id}", response_model=CredentialRead)
def read_credential(
    credential_id: UUID,
    _actor: Annotated[Operator, Depends(require_governance_read_operator)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> CredentialRead:
    """Fetch a persisted credential record by id."""
    row = get_credential(session, credential_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Credential not found")
    logger.debug("credentials.get credential_id=%s", credential_id)
    return _to_credential_read(row, settings)
