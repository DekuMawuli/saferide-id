"""Public passenger verification (no auth)."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.db.models.credential import Credential
from app.db.session import get_session
from app.schemas.disclosure import TrustPublicResponse
from app.services.operator_lookup import get_operator_by_verify_short_code
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


@router.get("/trust/{code}/vc-proof")
def trust_vc_proof(
    code: str,
    session: Annotated[Session, Depends(get_session)],
) -> dict:
    """
    Return the most recent issued VC summary for this short-code.
    Exposes only non-sensitive metadata: issuer, template, status, issued_at.
    Used by the verify page to show a cryptographic proof badge.
    """
    op = get_operator_by_verify_short_code(session, code)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown verification code")
    stmt = (
        select(Credential)
        .where(Credential.operator_id == op.id)
        .where(Credential.status == "ISSUED")
        .order_by(Credential.issued_at.desc())
    )
    cred = session.exec(stmt).first()
    if cred is None:
        return {"vc_issued": False}
    return {
        "vc_issued": True,
        "credential_type": cred.credential_type,
        "template_name": cred.template_name,
        "issuer": cred.issuer,
        "status": cred.status,
        "issued_at": cred.issued_at.isoformat() if cred.issued_at else None,
        "expires_at": cred.expires_at.isoformat() if cred.expires_at else None,
    }


@router.get("/trust/{code}/vc")
def trust_vc_full(
    code: str,
    session: Annotated[Session, Depends(get_session)],
    disclosure_token: str | None = Query(
        default=None,
        description="Token issued after driver approves a consent request (required)",
    ),
) -> dict:
    """
    Return the full signed Verifiable Credential for this short-code.

    Requires a valid `disclosure_token` — the passenger must first go through the
    consent flow and receive approval from the driver before the VC is released.

    The returned `credential` object is the raw signed JSON-LD VC as issued by
    Inji Certify, including the `proof` block for cryptographic verification.
    """
    op = get_operator_by_verify_short_code(session, code)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown verification code")

    from app.services.consent_service import validate_disclosure_token
    if not disclosure_token or not validate_disclosure_token(session, op.id, (disclosure_token or "").strip()):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="A valid disclosure_token is required to access the full credential. "
                   "Request one via POST /public/consent/request and await driver approval.",
        )

    stmt = (
        select(Credential)
        .where(Credential.operator_id == op.id)
        .where(Credential.status == "ISSUED")
        .order_by(Credential.issued_at.desc())
    )
    cred = session.exec(stmt).first()
    if cred is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No issued credential found for this driver")

    # Extract the signed VC from the Certify response stored in metadata_json.
    # Certify returns it under the "credential" key in the OpenID4VCI response.
    raw_meta = cred.metadata_json or {}
    signed_vc = (
        raw_meta.get("credential")
        or raw_meta.get("verifiableCredential")
        or raw_meta.get("vc")
    )

    return {
        "vc_issued": True,
        "credential_id": str(cred.id),
        "credential_type": cred.credential_type,
        "template_name": cred.template_name,
        "issuer": cred.issuer,
        "issued_at": cred.issued_at.isoformat() if cred.issued_at else None,
        "expires_at": cred.expires_at.isoformat() if cred.expires_at else None,
        "credential": signed_vc,
    }
