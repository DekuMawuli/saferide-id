"""In-memory store for the last eSignet callback payload per operator (debug / support)."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID


@dataclass(slots=True)
class ESignetDebugRow:
    operator_id: UUID
    claims: dict[str, Any]
    userinfo: dict[str, Any] | str | None
    created_at: int


class InMemoryEsignetDebugStore:
    """Replace with Redis or DB in production if you need durability across restarts."""

    def __init__(self, ttl_seconds: int = 86400) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._rows: dict[UUID, ESignetDebugRow] = {}

    def set(
        self,
        operator_id: UUID,
        *,
        claims: dict[str, Any],
        userinfo: dict[str, Any] | str | None,
    ) -> None:
        now = int(time.time())
        row = ESignetDebugRow(
            operator_id=operator_id,
            claims=claims,
            userinfo=userinfo,
            created_at=now,
        )
        with self._lock:
            self._gc_locked(now)
            self._rows[operator_id] = row

    def get(self, operator_id: UUID) -> ESignetDebugRow | None:
        now = int(time.time())
        with self._lock:
            self._gc_locked(now)
            row = self._rows.get(operator_id)
            if row is None:
                return None
            if now - row.created_at > self._ttl:
                self._rows.pop(operator_id, None)
                return None
            return row

    def _gc_locked(self, now: int) -> None:
        expired = [k for k, v in self._rows.items() if now - v.created_at > self._ttl]
        for k in expired:
            self._rows.pop(k, None)


esignet_debug_store = InMemoryEsignetDebugStore()
