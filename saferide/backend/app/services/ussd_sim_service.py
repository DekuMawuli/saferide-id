"""In-memory USSD session simulator (no carrier — dev / demo)."""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import timedelta
from typing import Any
from uuid import UUID as _UUID

from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models.consent_request import ConsentRequest
from app.db.models.operator import Operator
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding
from app.db.models.vehicle import Vehicle
from app.services.consent_service import (
    _utcnow,
    build_passenger_approval_message,
    respond_consent_request,
)
from app.services.emergency_service import create_emergency_share
from app.services.public_trust_service import get_trust_public
from app.services.sms_simulator_service import log_sim_sms

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {}


def _menu_text(is_driver: bool = False, is_passenger: bool = False) -> str:
    base = (
        "SafeRide\n"
        "1 Verify driver\n"
        "2 Panic share\n"
        "3 Request more detail\n"
    )
    if is_driver:
        base += "4 My consent requests\n"
    elif is_passenger:
        base += "4 My request status\n"
    return base + "0 Exit"


def _code_retry_prompt(prefix: str) -> str:
    return f"{prefix}\nEnter short code or 0 for main menu:"


def _find_operator_by_phone(session: Session, phone: str) -> Operator | None:
    """Look up an operator by MSISDN, tolerating +/without-plus variants."""
    p = phone.strip().replace(" ", "")
    variants = [p]
    if p.startswith("+"):
        variants.append(p[1:])
    else:
        variants.append(f"+{p}")
    return session.exec(select(Operator).where(Operator.phone.in_(variants))).first()


def _pending_requests_for_operator(
    session: Session, operator_id: Any
) -> list[ConsentRequest]:
    """Return pending consent requests for a driver, newest first, last 24h."""
    cutoff = _utcnow() - timedelta(hours=24)
    stmt = (
        select(ConsentRequest)
        .where(ConsentRequest.operator_id == operator_id)
        .where(ConsentRequest.status == "pending")
        .where(ConsentRequest.created_at >= cutoff)
        .order_by(ConsentRequest.created_at.desc())
        .limit(9)
    )
    return list(session.exec(stmt).all())


def _recent_requests_for_passenger(
    session: Session, msisdn: str
) -> list[ConsentRequest]:
    """Return recent consent requests a passenger initiated, newest first, last 48h."""
    cutoff = _utcnow() - timedelta(hours=48)
    p = msisdn.strip().replace(" ", "")
    variants = [p, f"+{p}"] if not p.startswith("+") else [p, p[1:]]
    stmt = (
        select(ConsentRequest)
        .where(ConsentRequest.passenger_msisdn.in_(variants))
        .where(ConsentRequest.created_at >= cutoff)
        .order_by(ConsentRequest.created_at.desc())
        .limit(9)
    )
    return list(session.exec(stmt).all())


def _time_ago(dt: Any) -> str:
    now = _utcnow()
    diff = now - dt
    total_sec = max(0, int(diff.total_seconds()))
    if total_sec < 60:
        return f"{total_sec}s ago"
    if total_sec < 3600:
        return f"{total_sec // 60}m ago"
    return f"{total_sec // 3600}h ago"


def _get_active_vehicle(session: Session, operator_id: Any) -> Vehicle | None:
    stmt = (
        select(OperatorVehicleBinding, Vehicle)
        .join(Vehicle, OperatorVehicleBinding.vehicle_id == Vehicle.id)
        .where(OperatorVehicleBinding.operator_id == operator_id)
        .where(OperatorVehicleBinding.is_active == True)  # noqa: E712
        .limit(1)
    )
    row = session.exec(stmt).first()
    return row[1] if row else None


def handle_ussd_turn(
    session: Session,
    settings: Settings,
    *,
    msisdn: str,
    session_id: str | None,
    user_input: str,
) -> dict:
    """
    AfricasTalking-style: return session_id, ussd_message, session_active.

    `ussd_message` is prefixed with CON (continue) or END (terminate) in the HTTP layer,
    or we return `continue_session` bool.
    """
    from app.core.rbac import normalize_operator_role

    text = (user_input or "").strip()
    phone = (msisdn or "unknown").strip() or "unknown"

    with _lock:
        sid = session_id
        if not sid or sid not in _sessions:
            sid = str(uuid.uuid4())
            op = _find_operator_by_phone(session, phone)
            role = normalize_operator_role(op.role) if op else None
            is_driver = role == "driver"
            # A passenger is either a registered passenger operator OR anyone who
            # has previously sent a consent request from this MSISDN.
            is_passenger = role == "passenger" or (
                not is_driver and bool(_recent_requests_for_passenger(session, phone))
            )
            _sessions[sid] = {
                "stage": "menu",
                "msisdn": phone,
                "is_driver": is_driver,
                "is_passenger": is_passenger,
            }
            st = _sessions[sid]
        else:
            st = _sessions[sid]

        stage = st.get("stage", "menu")
        is_driver: bool = st.get("is_driver", False)
        is_passenger: bool = st.get("is_passenger", False)

        # ── main menu ──────────────────────────────────────────────────────
        if stage == "menu":
            if text in ("", "0"):
                if text == "0":
                    del _sessions[sid]
                    return {
                        "session_id": sid,
                        "continue_session": False,
                        "message": "END Thank you. Stay safe.",
                    }
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            if text == "1":
                st["stage"] = "verify_code"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Enter driver short code:",
                }
            if text == "2":
                st["stage"] = "panic_code"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Panic: enter driver short code:",
                }
            if text == "3":
                st["stage"] = "consent_code"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Request detail: enter driver short code:",
                }
            if text == "4":
                if is_driver:
                    # Driver: view and action pending consent requests
                    op = _find_operator_by_phone(session, phone)
                    if op is None:
                        del _sessions[sid]
                        return {
                            "session_id": sid,
                            "continue_session": False,
                            "message": "END Your number is not registered as a driver.",
                        }
                    reqs = _pending_requests_for_operator(session, op.id)
                    if not reqs:
                        del _sessions[sid]
                        return {
                            "session_id": sid,
                            "continue_session": False,
                            "message": "END No pending requests in the last 24 hours.",
                        }
                    st["stage"] = "driver_requests"
                    st["operator_id"] = str(op.id)
                    st["request_ids"] = [str(r.id) for r in reqs]
                    lines = [
                        f"{i+1}. {r.passenger_msisdn or 'unknown'} ({r.channel}) {_time_ago(r.created_at)}"
                        for i, r in enumerate(reqs)
                    ]
                    menu = "\n".join(lines) + "\n0 Back"
                    return {
                        "session_id": sid,
                        "continue_session": True,
                        "message": f"CON Pending requests:\n{menu}",
                    }
                elif is_passenger:
                    # Passenger: check status of requests they submitted
                    reqs = _recent_requests_for_passenger(session, phone)
                    if not reqs:
                        del _sessions[sid]
                        return {
                            "session_id": sid,
                            "continue_session": False,
                            "message": "END No requests found in the last 48 hours.",
                        }
                    st["stage"] = "passenger_requests"
                    st["passenger_request_ids"] = [str(r.id) for r in reqs]
                    lines = [
                        f"{i+1}. {r.verify_short_code} {r.status.upper()} {_time_ago(r.created_at)}"
                        for i, r in enumerate(reqs)
                    ]
                    menu = "\n".join(lines) + "\n0 Back"
                    return {
                        "session_id": sid,
                        "continue_session": True,
                        "message": f"CON Your requests:\n{menu}",
                    }
                else:
                    return {
                        "session_id": sid,
                        "continue_session": True,
                        "message": f"CON Invalid choice.\n{_menu_text(is_driver, is_passenger)}",
                    }
            return {
                "session_id": sid,
                "continue_session": True,
                "message": f"CON Invalid choice.\n{_menu_text(is_driver, is_passenger)}",
            }

        # ── option 1: verify ───────────────────────────────────────────────
        if stage == "verify_code":
            if text == "0":
                st["stage"] = "menu"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Verify:')}",
                }
            trust = get_trust_public(session, text, tier="minimal")
            if trust is None:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Code not found.')}",
                }
            del _sessions[sid]
            plates = ", ".join(filter(None, [v.plate or v.display_name for v in trust.vehicles])) or "-"
            msg = f"END {trust.display_name or 'Driver'}|{trust.status}|{plates}|{trust.trust_band}"
            log_sim_sms(session, to_address=phone, body=f"USSD verify result: {msg[4:]}", tag="ussd")
            return {"session_id": sid, "continue_session": False, "message": msg}

        # ── option 2: panic ────────────────────────────────────────────────
        if stage == "panic_code":
            if text == "0":
                st["stage"] = "menu"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Panic:')}",
                }
            row = create_emergency_share(
                session, settings,
                verify_short_code=text,
                sender_msisdn=phone,
                note="via_ussd_sim",
            )
            if row is None:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Panic: invalid code.')}",
                }
            del _sessions[sid]
            return {
                "session_id": sid,
                "continue_session": False,
                "message": f"END Panic shared. SMS(sim)={row.sms_sent_count} Ref={str(row.id)[:8]}",
            }

        # ── option 3: passenger requests consent ──────────────────────────
        if stage == "consent_code":
            if text == "0":
                st["stage"] = "menu"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Request detail:')}",
                }
            from app.services.consent_service import create_consent_request
            req = create_consent_request(
                session, settings,
                verify_short_code=text,
                channel="ussd",
                passenger_msisdn=phone,
            )
            if req is None:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_code_retry_prompt('Code not found.')}",
                }
            del _sessions[sid]
            # The driver has already been notified by create_consent_request.
            # Confirm to the passenger that their request was sent.
            log_sim_sms(
                session,
                to_address=phone,
                body=f"SAFERIDE: Your request for driver {text.upper()} was sent. Dial back to check status. Ref={str(req.id)[:8]}",
                tag="consent",
            )
            return {
                "session_id": sid,
                "continue_session": False,
                "message": f"END Request sent to driver. Ref={str(req.id)[:8]}",
            }

        # ── option 4 (driver): view and action pending requests ────────────
        if stage == "driver_requests":
            if text == "0":
                st["stage"] = "menu"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            request_ids: list[str] = st.get("request_ids", [])
            try:
                choice = int(text)
                if choice < 1 or choice > len(request_ids):
                    raise ValueError
            except (ValueError, TypeError):
                lines = [f"{i+1}. req {rid[:6]}" for i, rid in enumerate(request_ids)]
                menu = "\n".join(lines) + "\n0 Back"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON Invalid. Choose 1-{len(request_ids)}:\n{menu}",
                }
            chosen_id = request_ids[choice - 1]
            req = session.get(ConsentRequest, _UUID(chosen_id))
            if req is None or req.status != "pending":
                del _sessions[sid]
                return {
                    "session_id": sid,
                    "continue_session": False,
                    "message": "END Request no longer pending.",
                }
            st["stage"] = "driver_request_action"
            st["selected_request_id"] = chosen_id
            passenger = req.passenger_msisdn or "unknown"
            ago = _time_ago(req.created_at)
            return {
                "session_id": sid,
                "continue_session": True,
                "message": (
                    f"CON Request from {passenger}\n"
                    f"Channel: {req.channel} | {ago}\n"
                    f"1 Approve\n"
                    f"2 Deny\n"
                    f"0 Back"
                ),
            }

        # ── driver approves or denies ──────────────────────────────────────
        if stage == "driver_request_action":
            if text == "0":
                op = _find_operator_by_phone(session, phone)
                if op is None:
                    del _sessions[sid]
                    return {"session_id": sid, "continue_session": False, "message": "END Session expired."}
                reqs = _pending_requests_for_operator(session, op.id)
                if not reqs:
                    del _sessions[sid]
                    return {"session_id": sid, "continue_session": False, "message": "END No more pending requests."}
                st["stage"] = "driver_requests"
                st["request_ids"] = [str(r.id) for r in reqs]
                lines = [
                    f"{i+1}. {r.passenger_msisdn or 'unknown'} ({r.channel}) {_time_ago(r.created_at)}"
                    for i, r in enumerate(reqs)
                ]
                menu = "\n".join(lines) + "\n0 Back"
                return {"session_id": sid, "continue_session": True, "message": f"CON Pending requests:\n{menu}"}

            if text not in ("1", "2"):
                req = session.get(ConsentRequest, _UUID(st.get("selected_request_id", str(uuid.uuid4()))))
                passenger = req.passenger_msisdn if req else "unknown"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON Request from {passenger}\n1 Approve\n2 Deny\n0 Back",
                }

            approve = text == "1"
            op_id = st.get("operator_id")
            req_id_str = st.get("selected_request_id", "")
            try:
                op_uuid = _UUID(op_id)
                req_uuid = _UUID(req_id_str)
            except Exception:
                del _sessions[sid]
                return {"session_id": sid, "continue_session": False, "message": "END Session error."}

            # respond_consent_request handles passenger SMS notification via _notify_passenger
            req = respond_consent_request(
                session, settings,
                request_id=req_uuid,
                operator_id=op_uuid,
                approve=approve,
            )
            del _sessions[sid]

            if req is None:
                return {
                    "session_id": sid,
                    "continue_session": False,
                    "message": "END Request expired or not found.",
                }

            action_word = "approved" if approve else "denied"
            return {
                "session_id": sid,
                "continue_session": False,
                "message": f"END Request {action_word}. Passenger notified via SMS.",
            }

        # ── option 4 (passenger): check status of their own requests ───────
        if stage == "passenger_requests":
            if text == "0":
                st["stage"] = "menu"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON {_menu_text(is_driver, is_passenger)}",
                }
            passenger_request_ids: list[str] = st.get("passenger_request_ids", [])
            try:
                choice = int(text)
                if choice < 1 or choice > len(passenger_request_ids):
                    raise ValueError
            except (ValueError, TypeError):
                reqs = _recent_requests_for_passenger(session, phone)
                lines = [
                    f"{i+1}. {r.verify_short_code} {r.status.upper()} {_time_ago(r.created_at)}"
                    for i, r in enumerate(reqs)
                ]
                menu = "\n".join(lines) + "\n0 Back"
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": f"CON Invalid. Choose 1-{len(passenger_request_ids)}:\n{menu}",
                }

            chosen_id = passenger_request_ids[choice - 1]
            req = session.get(ConsentRequest, _UUID(chosen_id))
            if req is None:
                del _sessions[sid]
                return {"session_id": sid, "continue_session": False, "message": "END Request not found."}

            del _sessions[sid]
            now = _utcnow()

            if req.status == "pending":
                if req.expires_at < now:
                    end_msg = f"END Driver {req.verify_short_code}: request expired."
                else:
                    mins_left = int((req.expires_at - now).total_seconds() // 60)
                    end_msg = f"END Driver {req.verify_short_code}: still waiting for approval ({mins_left}m left)."

            elif req.status == "approved":
                token_expired = req.disclosure_token_expires_at and req.disclosure_token_expires_at < now
                if token_expired:
                    end_msg = (
                        f"END Driver {req.verify_short_code}: approved but token expired.\n"
                        f"Request again via option 3."
                    )
                else:
                    token = req.disclosure_token or "—"
                    end_msg = (
                        f"END Driver {req.verify_short_code}: APPROVED\n"
                        f"Token: {token}"
                    )
                    # Send the token as an SMS so the passenger has it in their inbox
                    op = session.get(Operator, req.operator_id)
                    sms_body = (
                        build_passenger_approval_message(session, settings, op, req)
                        if op is not None
                        else (
                            f"SAFERIDE: Driver {req.verify_short_code} approved your request.\n"
                            f"Disclosure token: {token}"
                        )
                    )
                    log_sim_sms(
                        session,
                        to_address=phone,
                        body=sms_body,
                        tag="consent_token",
                    )

            elif req.status == "denied":
                end_msg = f"END Driver {req.verify_short_code}: request was denied."

            else:
                end_msg = f"END Driver {req.verify_short_code}: status is {req.status}."

            return {"session_id": sid, "continue_session": False, "message": end_msg}

        del _sessions[sid]
        return {
            "session_id": sid,
            "continue_session": False,
            "message": "END Session reset.",
        }
