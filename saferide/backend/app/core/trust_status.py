"""Operator trust lifecycle (governance + public verifier hints)."""

from __future__ import annotations

# Persisted on Operator.status (uppercase).
STATUS_PENDING = "PENDING"
STATUS_APPROVED = "APPROVED"
STATUS_ACTIVE = "ACTIVE"
STATUS_SUSPENDED = "SUSPENDED"
STATUS_EXPIRED = "EXPIRED"

OPERATOR_STATUSES: frozenset[str] = frozenset(
    {
        STATUS_PENDING,
        STATUS_APPROVED,
        STATUS_ACTIVE,
        STATUS_SUSPENDED,
        STATUS_EXPIRED,
    }
)

# Passenger-facing band for minimal trust UI.
TRUST_CLEAR = "CLEAR"
TRUST_CAUTION = "CAUTION"
TRUST_BLOCK = "BLOCK"


def normalize_operator_status(raw: str | None) -> str:
    if not raw:
        return STATUS_PENDING
    s = raw.strip().upper()
    return s if s in OPERATOR_STATUSES else STATUS_PENDING


def trust_band_for_status(status: str) -> str:
    """
    Map stored operator status to coarse passenger guidance.

    CLEAR: generally OK to treat as verified for boarding (subject to local policy).
    CAUTION: identity may be fine but not fully cleared / expired pathway.
    BLOCK: do not board / not cleared.
    """
    s = normalize_operator_status(status)
    if s in (STATUS_ACTIVE, STATUS_APPROVED):
        return TRUST_CLEAR if s == STATUS_ACTIVE else TRUST_CAUTION
    if s == STATUS_PENDING:
        return TRUST_BLOCK
    if s == STATUS_SUSPENDED:
        return TRUST_BLOCK
    if s == STATUS_EXPIRED:
        return TRUST_CAUTION
    return TRUST_BLOCK
