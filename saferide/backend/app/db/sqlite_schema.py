"""Lightweight SQLite column adds (no Alembic in this prototype)."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def ensure_sqlite_columns(engine: Engine) -> None:
    """Add columns introduced after first deploy so existing SQLite files keep working."""
    url = str(engine.url)
    if not url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(operators)")).fetchall()
        col_names = {r[1] for r in rows}
        if "verify_short_code" not in col_names:
            logger.info("sqlite_schema: adding operators.verify_short_code")
            conn.execute(
                text("ALTER TABLE operators ADD COLUMN verify_short_code VARCHAR(16)")
            )
            conn.commit()
        if "role" not in col_names:
            logger.info("sqlite_schema: adding operators.role")
            conn.execute(
                text("ALTER TABLE operators ADD COLUMN role VARCHAR(32) DEFAULT 'driver'")
            )
            conn.commit()
        if "email" not in col_names:
            logger.info("sqlite_schema: adding operators.email")
            conn.execute(text("ALTER TABLE operators ADD COLUMN email VARCHAR(320)"))
            conn.commit()
        if "password_hash" not in col_names:
            logger.info("sqlite_schema: adding operators.password_hash")
            conn.execute(text("ALTER TABLE operators ADD COLUMN password_hash VARCHAR(512)"))
            conn.commit()
        if "individual_id" not in col_names:
            logger.info("sqlite_schema: adding operators.individual_id")
            conn.execute(text("ALTER TABLE operators ADD COLUMN individual_id VARCHAR(256)"))
            conn.commit()
        if "gender" not in col_names:
            logger.info("sqlite_schema: adding operators.gender")
            conn.execute(text("ALTER TABLE operators ADD COLUMN gender VARCHAR(32)"))
            conn.commit()
        if "birthdate" not in col_names:
            logger.info("sqlite_schema: adding operators.birthdate")
            conn.execute(text("ALTER TABLE operators ADD COLUMN birthdate VARCHAR(32)"))
            conn.commit()
        if "registration_type" not in col_names:
            logger.info("sqlite_schema: adding operators.registration_type")
            conn.execute(text("ALTER TABLE operators ADD COLUMN registration_type VARCHAR(128)"))
            conn.commit()
        if "corporate_body_id" not in col_names:
            logger.info("sqlite_schema: adding operators.corporate_body_id")
            conn.execute(text("ALTER TABLE operators ADD COLUMN corporate_body_id VARCHAR(36)"))
            conn.commit()
        if "esignet_last_access_token" not in col_names:
            logger.info("sqlite_schema: adding operators.esignet_last_access_token")
            conn.execute(text("ALTER TABLE operators ADD COLUMN esignet_last_access_token VARCHAR(4096)"))
            conn.commit()
        if "esignet_token_expires_at" not in col_names:
            logger.info("sqlite_schema: adding operators.esignet_token_expires_at")
            conn.execute(text("ALTER TABLE operators ADD COLUMN esignet_token_expires_at DATETIME"))
            conn.commit()

    # ride_events table (new — created by SQLModel on first boot, but ensure it exists)
    with engine.connect() as conn:
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "ride_events" not in tables:
            logger.info("sqlite_schema: creating ride_events table")
            conn.execute(text("""
                CREATE TABLE ride_events (
                    id VARCHAR(36) PRIMARY KEY,
                    operator_id VARCHAR(36) NOT NULL REFERENCES operators(id),
                    verify_short_code VARCHAR(16) NOT NULL,
                    channel VARCHAR(32) NOT NULL DEFAULT 'WEB',
                    passenger_msisdn VARCHAR(32),
                    event_type VARCHAR(64) NOT NULL DEFAULT 'consent_approved',
                    consent_request_id VARCHAR(36),
                    recorded_at DATETIME NOT NULL
                )
            """))
            conn.execute(text("CREATE INDEX idx_ride_events_operator_id ON ride_events(operator_id)"))
            conn.execute(text("CREATE INDEX idx_ride_events_verify_short_code ON ride_events(verify_short_code)"))
            conn.execute(text("CREATE INDEX idx_ride_events_consent_request_id ON ride_events(consent_request_id)"))
            conn.commit()

    # vehicles: extended metadata (plate details, association)
    with engine.connect() as conn:
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "vehicles" in tables:
            vcols = {r[1] for r in conn.execute(text("PRAGMA table_info(vehicles)")).fetchall()}
            if "vehicle_type" not in vcols:
                logger.info("sqlite_schema: adding vehicles.vehicle_type")
                conn.execute(text("ALTER TABLE vehicles ADD COLUMN vehicle_type VARCHAR(64)"))
                conn.commit()
            if "make_model" not in vcols:
                logger.info("sqlite_schema: adding vehicles.make_model")
                conn.execute(text("ALTER TABLE vehicles ADD COLUMN make_model VARCHAR(256)"))
                conn.commit()
            if "color" not in vcols:
                logger.info("sqlite_schema: adding vehicles.color")
                conn.execute(text("ALTER TABLE vehicles ADD COLUMN color VARCHAR(64)"))
                conn.commit()
            if "corporate_body_id" not in vcols:
                logger.info("sqlite_schema: adding vehicles.corporate_body_id")
                conn.execute(text("ALTER TABLE vehicles ADD COLUMN corporate_body_id VARCHAR(36)"))
                conn.commit()
