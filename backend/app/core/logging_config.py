"""Tune log levels for the app and uvicorn (handlers come from uvicorn)."""

from __future__ import annotations

import logging


def setup_logging(*, debug: bool) -> None:
    """
    Align root and `app.*` log levels with `DEBUG` / `INFO`.

    Call from app lifespan after the worker starts so uvicorn logging is already configured.
    """
    level = logging.DEBUG if debug else logging.INFO
    logging.getLogger().setLevel(level)
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
