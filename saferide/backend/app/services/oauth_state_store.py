"""Temporary state store for OAuth transactions (in-memory with TTL)."""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class OAuthTxn:
    state: str
    code_verifier: str
    nonce: str
    next_path: str | None
    onboarding_operator_id: UUID | None
    onboarding_corporate_body_id: UUID | None
    created_at: int
    expires_at: int


class InMemoryOAuthStateStore:
    """Simple swappable store; replace with Redis implementation in production clusters."""

    def __init__(self, ttl_seconds: int = 600) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._rows: dict[str, OAuthTxn] = {}

    def create(
        self,
        *,
        code_verifier: str,
        nonce: str,
        next_path: str | None,
        onboarding_operator_id: UUID | None = None,
        onboarding_corporate_body_id: UUID | None = None,
    ) -> OAuthTxn:
        now = int(time.time())
        state = secrets.token_urlsafe(32)
        txn = OAuthTxn(
            state=state,
            code_verifier=code_verifier,
            nonce=nonce,
            next_path=next_path,
            onboarding_operator_id=onboarding_operator_id,
            onboarding_corporate_body_id=onboarding_corporate_body_id,
            created_at=now,
            expires_at=now + self._ttl,
        )
        with self._lock:
            self._gc_locked(now)
            self._rows[state] = txn
        return txn

    def consume(self, state: str) -> OAuthTxn | None:
        now = int(time.time())
        with self._lock:
            self._gc_locked(now)
            txn = self._rows.pop(state, None)
        if txn is None or txn.expires_at <= now:
            return None
        return txn

    def _gc_locked(self, now: int) -> None:
        expired = [k for k, v in self._rows.items() if v.expires_at <= now]
        for k in expired:
            self._rows.pop(k, None)


oauth_state_store = InMemoryOAuthStateStore()
