"""CLI entry: run the API with uvicorn (working directory should be `backend/`)."""

# Uvicorn is the ASGI server; `log_level` / `access_log` mirror CLI flags.
import uvicorn

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    log_level = "debug" if settings.debug else "info"
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=log_level,
        access_log=True,
        use_colors=True,
    )


if __name__ == "__main__":
    main()
