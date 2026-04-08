"""Application settings (Pydantic Settings / env)."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.rbac import parse_next_allowlist_csv


class Settings(BaseSettings):
    """Central configuration loaded from environment and optional `.env` file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Core app ---
    app_name: str = Field(default="Saferide API")
    environment: str = Field(default="local")
    debug: bool = Field(default=False)

    database_url: str = Field(default="sqlite:///./saferide.db")
    api_v1_prefix: str = Field(default="/api/v1")

    secret_key: str = Field(
        default="change-me-use-long-random-string",
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET"),
        min_length=16,
        description="HMAC secret for OAuth state and SafeRide-issued access tokens",
    )
    access_token_expire_minutes: int = Field(
        default=60 * 24,
        ge=1,
        validation_alias=AliasChoices("ACCESS_TOKEN_EXPIRE_MINUTES", "JWT_ACCESS_EXPIRES_MINUTES"),
    )
    refresh_token_expire_days: int = Field(
        default=30,
        ge=1,
        validation_alias=AliasChoices("REFRESH_TOKEN_EXPIRE_DAYS", "JWT_REFRESH_EXPIRES_DAYS"),
    )

    cors_origins_csv: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        validation_alias="CORS_ORIGINS",
    )
    cors_origin_regex: str = Field(
        default=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        validation_alias="CORS_ORIGIN_REGEX",
        description="Regex used by CORS middleware for local dev origins on any port",
    )

    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000, ge=1, le=65535)
    admin_bootstrap_secret: str = Field(
        default="",
        validation_alias="ADMIN_BOOTSTRAP_SECRET",
        description="Optional secret to bootstrap first local system_admin account (dev/onetime)",
    )

    # --- Frontend + OAuth redirect (RBAC) ---
    frontend_app_url: str = Field(
        default="http://localhost:3000",
        description="Next.js origin; eSignet callback redirects here with token in URL hash",
    )
    oauth_next_path_allowlist: str = Field(
        default=(
            "/,/driver/profile,/portal,/admin,/login,/verify,"
            "/how-it-works,/privacy,/report,/offline,/simulate/ussd,/simulate/sms,/driver/consent"
        ),
        description="Comma-separated relative paths allowed for /auth/esignet/login?next=",
    )

    def oauth_next_paths_allowlist_set(self) -> frozenset[str]:
        return parse_next_allowlist_csv(self.oauth_next_path_allowlist)

    # --- MOSIP eSignet (OIDC) ---
    app_base_url: str = Field(default="http://localhost:8000", validation_alias="APP_BASE_URL")
    esignet_issuer: str = Field(default="http://localhost:8088", validation_alias="ESIGNET_ISSUER")
    esignet_base_url: str = Field(
        default="http://localhost:8088",
        description="Base URL of the running eSignet instance (for logging / future discovery helpers)",
    )
    esignet_authorization_url: str = Field(
        default="http://localhost:8088/authorize",
        validation_alias=AliasChoices("ESIGNET_AUTHORIZATION_URL", "ESIGNET_AUTHORIZATION_ENDPOINT"),
        description="OAuth2/OIDC authorization endpoint (full URL)",
    )
    esignet_token_url: str = Field(
        default="http://localhost:8088/v1/esignet/oauth/v2/token",
        validation_alias=AliasChoices("ESIGNET_TOKEN_URL", "ESIGNET_TOKEN_ENDPOINT"),
        description="OAuth2 token endpoint (full URL)",
    )
    esignet_userinfo_url: str = Field(
        default="http://localhost:8088/v1/esignet/oidc/userinfo",
        validation_alias=AliasChoices("ESIGNET_USERINFO_URL", "ESIGNET_USERINFO_ENDPOINT"),
        description="OIDC userinfo endpoint (full URL)",
    )
    esignet_jwks_uri: str = Field(
        default="http://localhost:8088/.well-known/jwks.json",
        validation_alias="ESIGNET_JWKS_URI",
        description="OIDC JWKS URI used to validate ID token signatures",
    )
    esignet_wellknown_url: str = Field(
        default="",
        description="OpenID Provider Metadata URL (.well-known/openid-configuration)",
    )
    esignet_client_id: str = Field(default="", description="Registered OIDC client id")
    esignet_redirect_uri: str = Field(
        default="http://localhost:8000/auth/esignet/callback",
        description="Callback URL registered with eSignet (must match this deployment)",
    )
    esignet_scopes: str = Field(
        default="openid profile email phone",
        description="Space-separated OIDC scopes",
    )
    esignet_acr_values: str = Field(
        default="",
        description="Optional acr_values parameter for the authorize request",
    )
    esignet_vci_otp: str = Field(
        default="111111",
        description="OTP/code used for the local browserless VCI auth flow",
    )
    esignet_vci_otp_channels: str = Field(
        default="email,phone",
        description="Comma-separated OTP channels requested for the local VCI auth flow",
    )
    esignet_private_key_path: Path | None = Field(
        default=None,
        description="PEM path for RSA private key (private_key_jwt client auth at token endpoint)",
    )
    esignet_private_key_kid: str = Field(
        default="",
        validation_alias="ESIGNET_PRIVATE_KEY_KID",
        description="Optional JOSE kid header for private_key_jwt assertions",
    )
    esignet_client_assertion_alg: str = Field(
        default="RS256",
        validation_alias="ESIGNET_CLIENT_ASSERTION_ALG",
        description="Signing algorithm for private_key_jwt (RS256/PS256/ES256)",
    )
    esignet_public_key_path: Path | None = Field(
        default=None,
        description="PEM path for eSignet signing key used to verify userinfo JWTs when applicable",
    )
    mock_identity_database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5455/mosip_mockidentitysystem",
        description="Optional direct Postgres URL for the local mock-identity registry used to recover missing individual_id values",
    )

    # --- Inji Certify (VC issuance) ---
    inji_certify_enable: bool = Field(
        default=False,
        description="When false, issuance endpoints return 503 with a clear message",
    )
    inji_certify_base_url: str = Field(
        default="",
        description="Base URL of Inji Certify issuance API (no trailing slash required)",
    )
    inji_certify_identifier: str = Field(
        default="",
        description="Credential issuer identifier / proof audience expected by Inji Certify",
    )
    inji_certify_api_key: str = Field(
        default="",
        description="Optional API key / bearer secret for Inji (sent as Bearer if non-empty)",
    )
    inji_certify_issuer_id: str = Field(
        default="",
        description="Issuer identifier registered with Inji / VC profile",
    )
    inji_certify_timeout: float = Field(
        default=30.0,
        ge=1.0,
        le=300.0,
        description="HTTP client timeout (seconds) for Inji calls",
    )
    inji_certify_operator_credential_template: str = Field(
        default="SafeRideDriverCredential",
        description="Credential configuration id / type used for operator credentials",
    )
    inji_certify_vehicle_credential_template: str = Field(
        default="SafeRideVehicleBindingCredential",
        description="Credential configuration id / type used for operator–vehicle binding credentials",
    )
    inji_certify_operator_issue_path: str = Field(
        default="/v1/certify/issuance/credential",
        description="Relative path under base URL for operator credential issuance",
    )
    inji_certify_vehicle_issue_path: str = Field(
        default="/v1/certify/issuance/credential",
        description="Relative path under base URL for vehicle-binding issuance",
    )
    inji_certify_credential_issuer_path: str = Field(
        default="/v1/certify",
        description="Relative path under base URL for the OpenID4VCI credential issuer identifier",
    )
    inji_web_base_url: str = Field(
        default="http://localhost:3004",
        description="Base URL of the local Inji Web wallet UI",
    )

    # --- Disclosure consent + simulated channels (lab) ---
    consent_request_ttl_minutes: int = Field(default=15, ge=5, le=1440)
    disclosure_token_ttl_minutes: int = Field(default=60, ge=5, le=10080)
    sim_emergency_sms_recipients_csv: str = Field(
        default="",
        validation_alias="SIM_EMERGENCY_SMS_RECIPIENTS",
        description="Comma-separated MSISDNs to receive simulated panic SMS",
    )

    def sim_emergency_sms_recipients_list(self) -> list[str]:
        raw = self.sim_emergency_sms_recipients_csv.strip()
        if not raw:
            return []
        return [p.strip() for p in raw.split(",") if p.strip()]

    @field_validator("esignet_private_key_path", "esignet_public_key_path", mode="before")
    @classmethod
    def blank_path_to_none(cls, value: object) -> Path | None:
        if value is None or value == "":
            return None
        if isinstance(value, Path):
            return value
        return Path(str(value))

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_csv.strip()
        if not raw:
            return ["http://localhost:3000"]
        return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
