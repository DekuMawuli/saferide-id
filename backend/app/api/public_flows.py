"""Public consent, panic, reports, and lab simulators (no authentication)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.db.models.public_report import PublicIncidentReport
from app.db.session import get_session
from app.schemas.public_consent import (
    ConsentRequestCreate,
    ConsentRequestCreateResponse,
)
from app.schemas.public_emergency import (
    EmergencyShareCreate,
    PublicReportCreate,
    SimSmsSendBody,
    UssdSimTurnBody,
)
from app.db.models.ride_event import RideEvent
from app.services.consent_service import create_consent_request, poll_consent_request
from app.services.emergency_service import create_emergency_share, format_share_public
from app.services.sms_simulator_service import list_sim_sms, log_sim_sms
from app.services.ussd_sim_service import handle_ussd_turn

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])


def _settings_dep() -> Settings:
    return get_settings()


@router.post("/consent/request", response_model=ConsentRequestCreateResponse)
def public_consent_request(
    body: ConsentRequestCreate,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(_settings_dep)],
) -> ConsentRequestCreateResponse:
    req = create_consent_request(
        session,
        settings,
        verify_short_code=body.verify_short_code,
        channel=body.channel,
        passenger_msisdn=body.passenger_msisdn,
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown verification code")
    return ConsentRequestCreateResponse(
        request_id=req.id,
        expires_at=req.expires_at.isoformat(),
        poll_url_hint=f"/public/consent/status/{req.id}",
    )


@router.get("/consent/status/{request_id}")
def public_consent_status(
    request_id: UUID,
    session: Annotated[Session, Depends(get_session)],
) -> dict:
    return poll_consent_request(session, request_id)


@router.post("/emergency/share")
def public_emergency_share(
    body: EmergencyShareCreate,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(_settings_dep)],
) -> dict:
    row = create_emergency_share(
        session,
        settings,
        verify_short_code=body.verify_short_code,
        sender_msisdn=body.sender_msisdn,
        note=body.note,
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown verification code")
    return format_share_public(row)


@router.post("/report", status_code=status.HTTP_201_CREATED)
def public_submit_report(
    body: PublicReportCreate,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(_settings_dep)],
) -> dict:
    row = PublicIncidentReport(
        operator_code=(body.operator_code or "").strip().upper() or None,
        incident_type=body.incident_type.strip(),
        details=body.details.strip(),
        location=(body.location or "").strip() or None,
        contact=(body.contact or "").strip() or None,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    logger.info("public.report id=%s", row.id)
    summary = (
        f"Type: {row.incident_type}\nCode: {row.operator_code or '-'}\n{row.details[:400]}"
    )
    for dest in settings.sim_emergency_sms_recipients_list():
        log_sim_sms(
            session,
            to_address=dest,
            body=f"[SafeRide REPORT]\n{summary}",
            tag="report",
        )
    return {"report_id": str(row.id), "ok": True}


@router.get("/reports")
def public_list_reports(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 100,
) -> list[dict]:
    stmt = (
        select(PublicIncidentReport)
        .order_by(PublicIncidentReport.created_at.desc())
        .limit(min(limit, 500))
    )
    rows = list(session.exec(stmt).all())
    return [
        {
            "id": str(r.id),
            "operator_code": r.operator_code,
            "incident_type": r.incident_type,
            "details": r.details,
            "location": r.location,
            "contact": r.contact,
            "created_at": r.created_at.isoformat(),
            "status": "open",
        }
        for r in rows
    ]


@router.post("/simulate/ussd")
def public_simulate_ussd(
    body: UssdSimTurnBody,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(_settings_dep)],
) -> dict:
    out = handle_ussd_turn(
        session,
        settings,
        msisdn=body.msisdn,
        session_id=body.session_id,
        user_input=body.input,
    )
    return out


@router.get("/simulate/sms")
def public_simulate_sms_list(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 100,
    to_msisdn: Annotated[
        str | None,
        Query(
            alias="to",
            description="If set, only rows whose simulated recipient matches this MSISDN (+ optional).",
        ),
    ] = None,
) -> list[dict]:
    rows = list_sim_sms(session, limit=limit, to_address=to_msisdn)
    return [
        {
            "id": str(r.id),
            "to": r.to_address,
            "body": r.body,
            "tag": r.tag,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/ride-events")
def public_list_ride_events(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 200,
) -> list[dict]:
    stmt = (
        select(RideEvent)
        .order_by(RideEvent.recorded_at.desc())
        .limit(min(limit, 1000))
    )
    rows = list(session.exec(stmt).all())
    return [
        {
            "id": str(r.id),
            "operator_id": str(r.operator_id),
            "verify_short_code": r.verify_short_code,
            "channel": r.channel,
            "passenger_msisdn": r.passenger_msisdn,
            "event_type": r.event_type,
            "consent_request_id": str(r.consent_request_id) if r.consent_request_id else None,
            "recorded_at": r.recorded_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/simulate/sms", status_code=status.HTTP_201_CREATED)
def public_simulate_sms_send(
    body: SimSmsSendBody,
    session: Annotated[Session, Depends(get_session)],
) -> dict:
    row = log_sim_sms(
        session,
        to_address=body.to_address,
        body=body.body,
        tag=body.tag,
    )
    return {"id": str(row.id), "ok": True}
