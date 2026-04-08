"""Tune log levels for the app and attach console + rotating file handlers."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parents[3] / "logs"
LOG_FILE = LOG_DIR / "saferide.log"

_FMT = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"


def setup_logging(*, debug: bool) -> None:
    """
    Configure app logging with an explicit StreamHandler (console) and a
    RotatingFileHandler (logs/saferide.log) so messages are always visible.
    """
    level = logging.DEBUG if debug else logging.INFO
    formatter = logging.Formatter(_FMT, datefmt=_DATE_FMT)

    app_logger = logging.getLogger("app")
    if not app_logger.handlers:
        # Console
        console = logging.StreamHandler(sys.stdout)
        console.setFormatter(formatter)
        app_logger.addHandler(console)

        # File — rotate at 5 MB, keep 3 backups
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        app_logger.addHandler(file_handler)

    app_logger.propagate = False  # avoid duplicate lines from uvicorn's root handler

    for name in (
        "app",
        "app.http",
        "app.api",
        "app.api.auth",
        "app.api.credentials",
        "app.api.operators",
        "app.services",
        "app.services.credential_service",
        "app.services.inji_certify_service",
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
    ):
        logging.getLogger(name).setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
