"""Engine, session factory, and schema initialization."""

from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings
from app.db.models.consent_request import ConsentAuditEntry, ConsentRequest  # noqa: F401
from app.db.models.credential import Credential  # noqa: F401
from app.db.models.emergency_share import EmergencyShare  # noqa: F401
from app.db.models.operator import Operator  # noqa: F401
from app.db.models.operator_vehicle_binding import OperatorVehicleBinding  # noqa: F401
from app.db.models.public_report import PublicIncidentReport  # noqa: F401
from app.db.models.sim_sms import SimSmsMessage  # noqa: F401
from app.db.models.vehicle import Vehicle  # noqa: F401
from app.db.sqlite_schema import ensure_sqlite_columns


@lru_cache
def get_engine():
    settings = get_settings()
    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(settings.database_url, connect_args=connect_args)


def init_db() -> None:
    """Create database tables (idempotent)."""
    eng = get_engine()
    SQLModel.metadata.create_all(eng)
    ensure_sqlite_columns(eng)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional scope."""
    with Session(get_engine()) as session:
        yield session
