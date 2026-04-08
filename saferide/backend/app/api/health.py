"""Operational health checks."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session

router = APIRouter(tags=["ops"])


def _settings_dep() -> Settings:
    return get_settings()


@router.get("/health")
def health_check(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(_settings_dep)],
) -> dict[str, str]:
    """Lightweight liveness/readiness probe for app and database reachability."""
    try:
        session.exec(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - defensive operational path
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database health check failed",
        ) from exc

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "database": "ok",
    }
