"""Engine, session factory, and schema initialization."""

from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings
from app.db.models.consent_request import ConsentAuditEntry, ConsentRequest  # noqa: F401
from app.db.models.corporate_body import CorporateBody  # noqa: F401
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
    is_sqlite = settings.database_url.startswith("sqlite")
    engine_kwargs = {}
    if is_sqlite:
        # Wait up to 15s when another request is holding a write lock.
        connect_args["timeout"] = 15
        # SQLite file DB works across worker threads in dev server.
        connect_args["check_same_thread"] = False
        engine_kwargs["pool_pre_ping"] = True
    eng = create_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)
    if is_sqlite:
        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_connection, _connection_record):
            cur = dbapi_connection.cursor()
            # Better concurrent read/write behavior for dev workloads.
            cur.execute("PRAGMA journal_mode=WAL;")
            cur.execute("PRAGMA busy_timeout=15000;")
            cur.close()
    return eng


def init_db() -> None:
    """Create database tables (idempotent)."""
    eng = get_engine()
    SQLModel.metadata.create_all(eng)
    ensure_sqlite_columns(eng)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional scope."""
    with Session(get_engine()) as session:
        yield session
