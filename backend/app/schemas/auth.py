"""Auth-related request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.operator import OperatorRead


class ESignetCallbackResponse(BaseModel):
    """Successful OAuth callback: persisted operator + SafeRide API token."""

    message: str = Field(default="Signed in with eSignet")
    operator: OperatorRead
    access_token: str
    token_type: str = Field(default="bearer")
    expires_in: int = Field(description="Access token lifetime in seconds")
    role: str = Field(description="Operator RBAC role")
    redirect_to: str = Field(
        description="SPA URL (with hash) the browser would be sent to; included when response_mode=json",
    )


class AuthMeResponse(BaseModel):
    """Current operator derived from Bearer token (or unauthenticated placeholder)."""

    authenticated: bool
    operator: OperatorRead | None = None
    role: str | None = Field(
        default=None,
        description="Convenience copy of operator.role when authenticated",
    )
    note: str | None = Field(
        default=None,
        description="Hints when unauthenticated (e.g. missing Authorization header)",
    )
