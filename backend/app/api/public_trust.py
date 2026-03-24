"""Public passenger verification (no auth)."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.disclosure import TrustPublicResponse
from app.services.public_trust_service import get_trust_public

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/trust/{code}", response_model=TrustPublicResponse)
def trust_by_short_code(
    code: str,
    session: Annotated[Session, Depends(get_session)],
    tier: str = Query(
        default="standard",
        description="minimal | standard | extended (extended needs disclosure_token)",
    ),
    disclosure_token: str | None = Query(
        default=None,
        description="Issued after operator approves a consent request",
    ),
) -> TrustPublicResponse:
    """
    Trust facts by disclosure tier.

    - **minimal**: masked name, no photo/phone/operator_id (USSD-friendly).
    - **standard**: full name, photo, vehicles, operator_id (web default).
    - **extended**: adds phone, verified_at, masked OIDC subject (requires disclosure_token).
    """
    row = get_trust_public(
        session,
        code,
        tier=tier,
        disclosure_token=disclosure_token,
    )
    if row is None:
        if (tier or "").lower() == "extended" and disclosure_token:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired disclosure token for this code",
            )
        logger.debug("public.trust miss code=%s", (code or "")[:16])
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown verification code")
    return row
