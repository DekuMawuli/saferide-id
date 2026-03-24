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
