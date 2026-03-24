"""FastAPI application entry."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.bindings import router as bindings_router
from app.api.credentials import router as credentials_router
from app.api.operators import router as operators_router
from app.api.public_flows import router as public_flows_router
from app.api.public_trust import router as public_trust_router
from app.api.vehicles import router as vehicles_router
from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.db.session import init_db
from app.middleware.request_logging import RequestLoggingMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    setup_logging(debug=settings.debug)
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        debug=settings.debug,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(auth_router)
    app.include_router(public_trust_router)
    app.include_router(public_flows_router)
    app.include_router(operators_router)
    app.include_router(vehicles_router)
    app.include_router(bindings_router)
    app.include_router(credentials_router)
    return app


app = create_app()
