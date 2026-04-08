"""JWKS retrieval + cache for ID token verification."""

from __future__ import annotations

import logging
import json
import threading
import time
from typing import Any

import httpx
import jwt

logger = logging.getLogger(__name__)


class JwksService:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._cached_until = 0
        self._jwks: dict[str, Any] | None = None

    async def get_jwks(self, jwks_uri: str) -> dict[str, Any]:
        now = int(time.time())
        with self._lock:
            if self._jwks is not None and now < self._cached_until:
                return self._jwks
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(jwks_uri, headers={"Accept": "application/json"})
            res.raise_for_status()
            body = res.json()
        if not isinstance(body, dict) or not isinstance(body.get("keys"), list):
            raise ValueError("JWKS response missing `keys` array")
        with self._lock:
            self._jwks = body
            self._cached_until = now + self._ttl
        return body

    async def get_signing_key(self, jwks_uri: str, kid: str | None) -> Any:
        jwks = await self.get_jwks(jwks_uri)
        keys = jwks.get("keys") or []
        if kid:
            for key in keys:
                if key.get("kid") == kid:
                    return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
        # Fallback for single-key or missing kid cases.
        if keys:
            logger.warning("JWKS key id not matched; falling back to first key")
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(keys[0]))
        raise ValueError("No signing keys in JWKS")


jwks_service = JwksService()
