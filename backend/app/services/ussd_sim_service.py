"""In-memory USSD session simulator (no carrier — dev / demo)."""

from __future__ import annotations

import logging
import threading
import uuid
from typing import Any

from sqlmodel import Session

from app.core.config import Settings
from app.services.consent_service import create_consent_request
from app.services.emergency_service import create_emergency_share
from app.services.public_trust_service import get_trust_public
from app.services.sms_simulator_service import log_sim_sms

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {}


def _menu_text() -> str:
    return (
        "SafeRide\n"
        "1 Verify driver\n"
        "2 Panic share\n"
        "3 Request more detail\n"
        "0 Exit"
    )


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
    text = (user_input or "").strip()
    phone = (msisdn or "unknown").strip() or "unknown"

    with _lock:
        sid = session_id
        if not sid or sid not in _sessions:
            sid = str(uuid.uuid4())
            _sessions[sid] = {"stage": "menu", "msisdn": phone}
            st = _sessions[sid]
        else:
            st = _sessions[sid]

        stage = st.get("stage", "menu")

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
                    "message": f"CON {_menu_text()}",
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
            return {
                "session_id": sid,
                "continue_session": True,
                "message": f"CON Invalid choice.\n{_menu_text()}",
            }

        if stage == "verify_code":
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Enter driver short code:",
                }
            trust = get_trust_public(session, text, tier="minimal")
            del _sessions[sid]
            if trust is None:
                return {
                    "session_id": sid,
                    "continue_session": False,
                    "message": "END Code not found.",
                }
            plates = ", ".join(filter(None, [v.plate or v.display_name for v in trust.vehicles])) or "-"
            msg = (
                f"END {trust.display_name or 'Driver'}|{trust.status}|{plates}|{trust.trust_band}"
            )
            log_sim_sms(
                session,
                to_address=phone,
                body=f"USSD verify result: {msg[4:]}",
                tag="ussd",
            )
            return {"session_id": sid, "continue_session": False, "message": msg}

        if stage == "panic_code":
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Panic: enter driver short code:",
                }
            row = create_emergency_share(
                session,
                settings,
                verify_short_code=text,
                sender_msisdn=phone,
                note="via_ussd_sim",
            )
            del _sessions[sid]
            if row is None:
                return {
                    "session_id": sid,
                    "continue_session": False,
                    "message": "END Panic: invalid code.",
                }
            return {
                "session_id": sid,
                "continue_session": False,
                "message": f"END Panic shared. SMS(sim)={row.sms_sent_count} Ref={str(row.id)[:8]}",
            }

        if stage == "consent_code":
            if not text:
                return {
                    "session_id": sid,
                    "continue_session": True,
                    "message": "CON Request detail: enter driver short code:",
                }
            req = create_consent_request(
                session,
                settings,
                verify_short_code=text,
                channel="ussd",
                passenger_msisdn=phone,
            )
            del _sessions[sid]
            if req is None:
                return {
                    "session_id": sid,
                    "continue_session": False,
                    "message": "END Code not found.",
                }
            log_sim_sms(
                session,
                to_address=phone,
                body=f"Consent requested id={req.id}. Ask driver to approve in app.",
                tag="consent",
            )
            return {
                "session_id": sid,
                "continue_session": False,
                "message": f"END Request {str(req.id)[:8]}. Ask driver to approve. Poll /public/consent/status/{req.id}",
            }

        del _sessions[sid]
        return {
            "session_id": sid,
            "continue_session": False,
            "message": "END Session reset.",
        }
