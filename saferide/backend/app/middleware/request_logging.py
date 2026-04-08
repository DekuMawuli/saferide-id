"""Log every HTTP request (method, path, status, duration)."""

from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Emit debug lines for each request/response (all mounted routes and docs)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        path = request.url.path
        logger.debug("http request start %s %s", request.method, path)
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception("http %s %s failed after %.2fms", request.method, path, elapsed_ms)
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        # One line per request at INFO so all routes are visible without DEBUG=true.
        logger.info(
            '%s "%s" %d %.2fms',
            request.method,
            path,
            response.status_code,
            elapsed_ms,
        )
        return response
