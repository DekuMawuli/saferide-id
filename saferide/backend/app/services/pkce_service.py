"""PKCE helpers (RFC 7636)."""

from __future__ import annotations

import base64
import hashlib
import secrets


def generate_code_verifier() -> str:
    """Return a high-entropy verifier (43-128 chars URL-safe)."""
    return secrets.token_urlsafe(64)


def build_s256_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
