"""Auth-related request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.operator import OperatorRead


class ESignetCallbackResponse(BaseModel):
    """Successful OAuth callback: persisted operator + SafeRide API token."""

    message: str = Field(default="Signed in with eSignet")
    operator: OperatorRead
    access_token: str
    refresh_token: str | None = Field(default=None)
    token_type: str = Field(default="bearer")
    expires_in: int = Field(description="Access token lifetime in seconds")
    refresh_expires_in: int | None = Field(default=None, description="Refresh token lifetime in seconds")
    role: str = Field(description="Operator RBAC role")
    auth_provider: str = Field(default="esignet")
    id_token_verified: bool = Field(default=True)
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


class ESignetTokenResponse(BaseModel):
    access_token: str
    id_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int | None = None
    scope: str | None = None
    refresh_token: str | None = None
    c_nonce: str | None = None
    c_nonce_expires_in: int | None = None


class ESignetUserInfoResponse(BaseModel):
    sub: str | None = None
    name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    individual_id: str | None = None
    gender: str | None = None
    birthdate: str | None = None
    picture: str | None = None
    registration_type: str | None = None


class ESignetIdentityClaims(BaseModel):
    sub: str
    name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    individual_id: str | None = None
    gender: str | None = None
    birthdate: str | None = None
    picture: str | None = None
    registration_type: str | None = None
    acr: str | None = None


class AuthStartResponse(BaseModel):
    authorization_url: str
    state: str
    expires_in: int = Field(description="State expiry in seconds")


class AuthErrorResponse(BaseModel):
    error: str
    error_description: str | None = None


class AdminLoginBody(BaseModel):
    email: str
    password: str


class RiderLoginBody(BaseModel):
    phone: str
    password: str


class AdminCreateBody(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: str = Field(
        default="monitor",
        description="monitor | support | officer | driver | admin | system_admin (passenger disallowed here)",
    )


class AdminBootstrapBody(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    bootstrap_secret: str
