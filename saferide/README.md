# SafeRide

Digital trust platform for informal transport: **Next.js** frontend, **FastAPI** backend, **MOSIP eSignet** for operator authentication, and **Inji Certify** for verifiable credential issuance.

**[Demo video](https://drive.google.com/file/d/1wzUji6QL-_xFuBvK1b_7cHiIVc6CuQdv/view?usp=sharing)**

---

## Architecture overview

SafeRide runs as three independently-managed Docker stacks that share a single Docker bridge network (`mosip_network`). A local `make dev` runs the FastAPI backend and Next.js frontend outside Docker (standard dev loop). The MOSIP infrastructure runs inside Docker and is left running in the background.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  mosip_network  (Docker bridge — all stacks share this)                     │
│                                                                             │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  eSignet stack                   │  │  Inji Certify stack               │ │
│  │  /SAFERIDE/esignet/              │  │  /SAFERIDE/inji/docker-compose/  │ │
│  │  docker-compose/                 │  │  docker-compose-injistack/       │ │
│  │                                  │  │                                  │ │
│  │  postgres:16  (:5455→5432)       │  │  postgres:15  (:5433→5432)       │ │
│  │  redis:6.0    (:6379)            │  │  certify      (:8090)            │ │
│  │  mock-identity-system  (:8082)   │  │  certify-nginx (:8091→80)        │ │
│  │  esignet      (:8088)            │  │  mimoto        (:8099)           │ │
│  │  esignet-ui   (:3000→3000)       │  │  inji-web      (:3004)           │ │
│  └──────────────────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

  FastAPI backend (host)   Next.js frontend (host)
  127.0.0.1:8000           localhost:3000
  (calls eSignet + Certify via localhost ports exposed above)
```

---

## Repository layout

```
/home/kofivi/SAFERIDE/
├── saferide/                      ← THIS REPO (Next.js + FastAPI)
│   ├── app/                       # Next.js App Router (pages + layouts)
│   ├── components/                # Shared UI components
│   ├── hooks/                     # e.g. use-operator-session
│   ├── lib/api/                   # API base URL, fetch helpers, types
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/               # FastAPI routers
│   │   │   ├── core/              # config, security (JWT), rbac, logging
│   │   │   ├── db/models/         # SQLModel ORM models
│   │   │   ├── middleware/        # Request logging
│   │   │   ├── schemas/           # Pydantic response models
│   │   │   └── services/          # eSignet, Inji, consent, USSD, SMS sim
│   │   ├── keys/                  # RSA key pair (not committed)
│   │   ├── main.py                # Optional uvicorn entry
│   │   ├── pyproject.toml         # Python deps (uv)
│   │   └── .env                   # Backend secrets (not committed)
│   ├── Makefile                   # install, backend, frontend, dev
│   ├── .env / .env.example        # Frontend env vars
│   └── next.config.ts             # Next.js config (standalone output, HMR flag)
│
├── inji/                          ← Inji Certify stack (git submodule)
│   └── docker-compose/
│       └── docker-compose-injistack/
│           ├── docker-compose.yaml
│           ├── certify-nginx.conf
│           ├── nginx.conf          # inji-web nginx (port 3004)
│           ├── certify_init.sql    # DB schema init
│           ├── mimoto_init.sql
│           ├── verify_init.sql
│           └── config/
│               ├── certify-default.properties
│               ├── certify-csvdp-farmer.properties
│               ├── certify-saferide.properties  ← SafeRide-specific overrides
│               ├── mimoto-issuers-config.json   ← includes SafeRide issuer
│               └── mimoto-default.properties
│
└── esignet/                       ← eSignet stack (git submodule)
    └── docker-compose/
        ├── docker-compose.yml
        ├── nginx.conf              # oidc-ui proxy config (port 3000)
        ├── init.sql                # DB init (esignet + mock schemas)
        ├── register_saferide_client.sh
        └── reset_esignet_keys.sh
```

---

## Docker stacks — full detail

### Shared network (create once)

Both Docker stacks **must** run on the same Docker bridge network so containers can reach each other by service name:

```bash
docker network create mosip_network
```

> This is idempotent — re-running is a no-op if the network already exists. The Inji `install.sh` creates it automatically.

---

### Stack 1 — eSignet

**Location:** `/home/kofivi/SAFERIDE/esignet/docker-compose/`

#### Services

| Service | Image | Host port | Purpose |
|---------|-------|-----------|---------|
| `database` | `postgres:16-bookworm` | 5455→5432 | PostgreSQL for eSignet + mock-identity schemas |
| `redis` | `redis:6.0` | 6379 | Spring cache for eSignet session state |
| `mock-identity-system` | `mosipid/mock-identity-system:0.12.0` | 8082 | Mock national ID / KYC provider |
| `esignet` | `mosipid/esignet-with-plugins:1.7.1` | 8088 | OIDC authorization server |
| `esignet-ui` | `mosipid/oidc-ui:1.7.1` | 3000 | eSignet login UI (proxied via nginx) |

#### Key configuration tweaks applied

- **Kafka disabled** — `KAFKA_ENABLED=false` + `SPRING_AUTOCONFIGURE_EXCLUDE` prevents the Spring Kafka auto-config from failing on startup. eSignet uses Redis for caching instead.
- **Redis cache** — `SPRING_CACHE_TYPE=redis`, `SPRING_REDIS_HOST=redis-server` (matches the `redis` container name set via `container_name: redis-server`).
- **Access token TTL extended** — `MOSIP_ESIGNET_ACCESS_TOKEN_EXPIRE_SECONDS=86400` (24 h) for local dev convenience.
- **CSRF ignore list** — all public and client-management paths added to `MOSIP_ESIGNET_SECURITY_IGNORE_CSRF_URLS` so the backend's server-side token exchange is not blocked.
- **mock-identity domain** — `MOSIP_ESIGNET_MOCK_DOMAIN_URL=http://mock-identity-system:8082` uses Docker service name for intra-network resolution.
- **Key binding** — `MOSIP_ESIGNET_INTEGRATION_KEY_BINDER=MockKeyBindingWrapperService` selects the mock binder (no HSM needed locally).
- **Custom nginx config** — `esignet-ui` mounts `./nginx.conf` which exposes clean well-known endpoints:
  - `GET /.well-known/openid-configuration` → proxied to `esignet:8088/v1/esignet/oidc/…`
  - `GET /.well-known/jwks.json` → proxied to `esignet:8088/v1/esignet/oauth/…`
  - `GET /v1/esignet` → proxied to `esignet:8088/v1/esignet`
- **Volume mounts** — `esignet_local.p12` keystore and `mock_local.p12` are mounted from `./data/` into the containers.
- **External network** — `mosip_network` declared as `external: true` so both stacks share the same bridge.

#### Starting the eSignet stack

```bash
cd /home/kofivi/SAFERIDE/esignet/docker-compose
docker compose up -d
```

Wait for eSignet to become healthy (30–60 s on first boot while DB schemas initialize):

```bash
# Health check
curl http://localhost:8088/v1/esignet/actuator/health
```

#### Registering the SafeRide OIDC client

After first boot (or after key reset), register `saferide-client` with eSignet:

```bash
cd /home/kofivi/SAFERIDE/esignet/docker-compose
./register_saferide_client.sh
# optionally override defaults:
./register_saferide_client.sh http://localhost:8088 /path/to/esignet_public.pem
```

The script:
1. Waits up to 150 s for eSignet to become healthy.
2. Reads the PEM public key and converts it to a JWK.
3. Posts to `POST /v1/esignet/client-mgmt/client` with `clientId=saferide-client`, `private_key_jwt` auth method, and the callback URI `http://127.0.0.1:8000/auth/esignet/callback`.
4. Skips gracefully if the client is already registered.

#### Resetting eSignet keys (when things break)

If eSignet fails to start with a `No such alias` error (stale DB key aliases after a container recreate):

```bash
cd /home/kofivi/SAFERIDE/esignet/docker-compose
./reset_esignet_keys.sh
```

The script:
1. Deletes `key_alias` + `key_store` rows from `mosip_esignet` and `mosip_mockidentitysystem` schemas via `docker exec`.
2. Force-recreates `esignet` and `mock-identity-system` containers for a clean keystore.
3. Waits for eSignet health, then re-runs `register_saferide_client.sh`.

---

### Stack 2 — Inji Certify

**Location:** `/home/kofivi/SAFERIDE/inji/docker-compose/docker-compose-injistack/`

#### Services

| Service | Image | Host port | Purpose |
|---------|-------|-----------|---------|
| `database` | `postgres:15` | 5433→5432 | PostgreSQL for Inji Certify + Mimoto + Verify schemas |
| `certify` | `injistack/inji-certify-with-plugins:0.14.0` | 8090 | VC issuance server |
| `certify-nginx` | `nginx:stable` | 8091→80 | Reverse proxy for Certify + static config serving |
| `mimoto-service` | `injistack/mimoto:0.21.0` | 8099 | Inji BFF (token proxy, issuers config) |
| `inji-web` | `injistack/inji-web:0.16.0` | 3004 | Inji Wallet web UI |

> Note: `verify-service` (port 8095) is commented out in the compose file. Uncomment to test Presentation During Issuance.

#### Key configuration tweaks applied

**Active Spring profiles for Certify:**
```
default,csvdp-farmer,saferide
```
The `saferide` profile (highest priority — loaded last) overrides the data provider:

**`certify-saferide.properties` — SafeRide-specific overrides:**
- Switches data provider from CSV to **PostgreSQL**: `mosip.certify.integration.data-provider-plugin=PostgresDataProviderPlugin`
- Connects to the SafeRide backend's database: `jdbc:postgresql://docker-compose-injistack-database-1:5432/saferide`
  - **Important:** Uses the full Docker container name (`docker-compose-injistack-database-1`) rather than just `database` to avoid hostname collision with eSignet's own `database` service on the shared `mosip_network`.
- Maps the `saferide_driver_vc_ldp` credential scope to a SQL query that JOINs `operators`, `operator_vehicle_bindings`, and `vehicles` tables.
  - The lookup accepts either the hashed eSignet subject or the plain `individual_id`, so the canonical SafeRide operator row can still be resolved after eSignet login.
  - SQL aliases are preserved as camelCase (`fullName`, `vehiclePlate`, `operatorCode`, etc.) because the `SafeRideDriverCredential` template expects those exact placeholder names.

**`certify-default.properties` — key settings:**
- DB hostname hardcoded to `docker-compose-injistack-database-1` (same container-name reason as above).
- Key manager uses PKCS12 at `CERTIFY_PKCS12/local.p12` (auto-generated on first run).
- Cache is `simple` (in-memory) for local dev; Redis disabled (`management.health.redis.enabled=false`).
- Access token TTL: 86400 s (24 h) for dev convenience.
- Issuer authentication points at eSignet: `mosip.certify.authorization.url=https://esignet-mock.collab.mosip.net` (override with local eSignet URL in certify-saferide.properties if desired).

**`certify-nginx.conf` — Certify reverse proxy (port 8091):**
Proxies and adds CORS headers for:
- `GET/POST /v1/certify/**` → `certify:8090/v1/certify/`
- `GET /.well-known/did.json` → `certify:8090/v1/certify/.well-known/did.json`
- `GET /.well-known/openid-credential-issuer` → `certify:8090/v1/certify/.well-known/openid-credential-issuer`
- Static files (issuers config, templates) served from `/config/server/`

**`nginx.conf` — inji-web (port 3004):**
- Listens on port 3004.
- Proxies `/v1/mimoto/` → `mimoto-service:8099/v1/mimoto/` with CORS.
- Serves JSON config files from `/home/mosip` and HTML templates matching `*-template.html`.

**`mimoto-issuers-config.json` — SafeRide issuer added:**
```json
{
  "issuer_id": "SafeRide",
  "credential_issuer": "SafeRide",
  "client_id": "saferide-client",
  "redirect_uri": "http://127.0.0.1:8000/auth/esignet/callback",
  "token_endpoint": "http://localhost:8099/v1/mimoto/get-token/SafeRide",
  "authorization_audience": "http://localhost:8088/v1/esignet/oauth/v2/token",
  "proxy_token_endpoint": "http://localhost:8088/v1/esignet/oauth/v2/token",
  "credential_issuer_host": "http://certify-nginx",
  "wellknown_endpoint": "http://certify-nginx/.well-known/openid-credential-issuer"
}
```

**External network:** Both stacks declare `mosip_network` as `external: true`. The Inji stack uses `name: mosip_network` so Docker resolves it correctly.

#### Starting the Inji stack

```bash
cd /home/kofivi/SAFERIDE/inji/docker-compose/docker-compose-injistack
docker compose up -d
```

Or using the top-level installer (creates the network, then offers a menu):

```bash
cd /home/kofivi/SAFERIDE/inji/docker-compose
bash install.sh
# select "2. Certify"
```

Verify all services are running:

```bash
docker compose ps
# Health endpoints:
curl http://localhost:8090/v1/certify/actuator/health
curl http://localhost:8091/.well-known/openid-credential-issuer
curl http://localhost:8099/v1/mimoto/actuator/health
```

#### Loading the SafeRide credential configuration

After the Inji stack is healthy, upsert the working SafeRide credential config from the repository payload:

```bash
cd /home/kofivi/SAFERIDE/saferide/backend
uv run python scripts/setup_inji_config.py
```

This loads the verified local configuration for:
- `credentialConfigKeyId=SafeRideDriverCredential`
- credential scope `saferide_driver_vc_ldp`
- the SafeRide VC template from `inji/docs/postman-collections/saferide-credential-configuration.payload.json`

Verify it is live:

```bash
curl http://localhost:8091/.well-known/openid-credential-issuer
```

Look for:
- `credential_configurations_supported.SafeRideDriverCredential.scope = saferide_driver_vc_ldp`

#### Stopping / cleaning the Inji stack

```bash
# Stop only
docker compose down

# Stop and remove volumes (full reset — re-generates keys on next start)
docker compose down -v
```

---

### Service port map (all stacks)

| Port | Service | Stack |
|------|---------|-------|
| 5455 | PostgreSQL (eSignet DB) | eSignet |
| 6379 | Redis | eSignet |
| 8082 | Mock Identity System | eSignet |
| 8088 | eSignet OIDC server | eSignet |
| 3000 | eSignet UI (nginx proxy) | eSignet |
| 5433 | PostgreSQL (Inji DB) | Inji Certify |
| 8090 | Inji Certify service | Inji Certify |
| 8091 | Certify nginx (proxy + static) | Inji Certify |
| 8099 | Mimoto BFF | Inji Certify |
| 3004 | Inji Web UI | Inji Certify |
| 8000 | SafeRide FastAPI backend | Host (make) |
| 3000* | SafeRide Next.js frontend | Host (make) |

> *SafeRide Next.js runs on port 3000 but `make dev` is only used when eSignet UI is not running. If both are started, move one to a different port (e.g. set `PORT=3001` in the Makefile call or in `.env`).

---

## SafeRide application — setup

### Prerequisites

- **Node.js** (LTS) and **npm**
- **Python 3.13+** and **[uv](https://github.com/astral-sh/uv)**
- **Docker** + **Docker Compose** v2
- eSignet and Inji stacks running (see above)

### Key generation (one time)

The backend uses an RSA key pair for `private_key_jwt` client authentication with eSignet. Generate once and register the public key with eSignet:

```bash
cd /home/kofivi/SAFERIDE/saferide/backend
mkdir -p keys
# Generate 2048-bit RSA key pair
openssl genrsa -out keys/esignet_private.pem 2048
openssl rsa -in keys/esignet_private.pem -pubout -out keys/esignet_public.pem
```

Then register with eSignet:

```bash
cd /home/kofivi/SAFERIDE/esignet/docker-compose
./register_saferide_client.sh http://localhost:8088 \
  /home/kofivi/SAFERIDE/saferide/backend/keys/esignet_public.pem
```

---

### Backend environment (`backend/.env`)

Copy from `backend/.env.example` and fill in the blanks:

```bash
cp backend/.env.example backend/.env
```

**Mandatory values to set:**

```env
# Core
SECRET_KEY=<long random string>
DATABASE_URL=sqlite:///./saferide.db   # or postgresql+psycopg://...

# eSignet OIDC
ESIGNET_CLIENT_ID=saferide-client
ESIGNET_BASE_URL=http://localhost:8088
ESIGNET_ISSUER=http://localhost:8088
ESIGNET_AUTHORIZATION_ENDPOINT=http://localhost:8088/authorize
ESIGNET_TOKEN_ENDPOINT=http://localhost:8088/v1/esignet/oauth/v2/token
ESIGNET_USERINFO_ENDPOINT=http://localhost:8088/v1/esignet/oidc/userinfo
ESIGNET_JWKS_URI=http://localhost:8088/.well-known/jwks.json
ESIGNET_REDIRECT_URI=http://127.0.0.1:8000/auth/esignet/callback
ESIGNET_SCOPES=openid profile email phone
ESIGNET_PRIVATE_KEY_PATH=./keys/esignet_private.pem
ESIGNET_VCI_OTP=111111
ESIGNET_VCI_OTP_CHANNELS=email,phone

# Frontend URL (where to redirect after login)
FRONTEND_APP_URL=http://localhost:3000

# CORS (must include frontend origin)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Optional: bootstrap the first admin user
ADMIN_BOOTSTRAP_SECRET=change-this-for-dev
```

**Optional / Inji Certify:**

```env
INJI_CERTIFY_ENABLE=false          # set true to enable VC issuance
INJI_CERTIFY_BASE_URL=http://127.0.0.1:8090
INJI_CERTIFY_IDENTIFIER=http://certify-nginx:80
INJI_CERTIFY_ISSUER_ID=SafeRide
INJI_CERTIFY_OPERATOR_CREDENTIAL_TEMPLATE=SafeRideDriverCredential
INJI_CERTIFY_OPERATOR_ISSUE_PATH=/v1/certify/issuance/credential
INJI_CERTIFY_CREDENTIAL_ISSUER_PATH=/v1/certify
INJI_WEB_BASE_URL=http://localhost:3004
```

**Important scope split:**

- `ESIGNET_SCOPES` is for normal SafeRide login and should remain:
  - `openid profile email phone`
- Certify issuance uses a separate credential scope:
  - `saferide_driver_vc_ldp`
- SafeRide mints a dedicated credential-scoped token during issuance; do not replace `ESIGNET_SCOPES` with the Certify scope in backend env.

**Verified local integration checklist:**

For the working local stack verified in this repo:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/saferide
ESIGNET_CLIENT_ID=saferide-client
ESIGNET_PRIVATE_KEY_PATH=./keys/esignet_private.pem
ESIGNET_SCOPES=openid profile email phone
ESIGNET_VCI_OTP=111111
ESIGNET_VCI_OTP_CHANNELS=email,phone
INJI_CERTIFY_ENABLE=true
INJI_CERTIFY_BASE_URL=http://127.0.0.1:8090
INJI_CERTIFY_IDENTIFIER=http://certify-nginx:80
INJI_CERTIFY_OPERATOR_CREDENTIAL_TEMPLATE=SafeRideDriverCredential
INJI_CERTIFY_OPERATOR_ISSUE_PATH=/v1/certify/issuance/credential
INJI_CERTIFY_CREDENTIAL_ISSUER_PATH=/v1/certify
INJI_WEB_BASE_URL=http://localhost:3004
```

Then:
1. Start eSignet
2. Register `saferide-client`
3. Start Inji Certify
4. Run `uv run python scripts/setup_inji_config.py`
5. Start SafeRide backend/frontend

**Full reference — all backend settings:**

| Variable | Default | Notes |
|----------|---------|-------|
| `SECRET_KEY` / `JWT_SECRET` | — | HMAC secret for SafeRide JWTs and OAuth state |
| `DATABASE_URL` | `sqlite:///./saferide.db` | SQLite for dev; set `postgresql+psycopg://…` for Postgres |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 1440 | SafeRide access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 30 | Refresh token TTL |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Comma-separated origins |
| `CORS_ORIGIN_REGEX` | `^https?://(localhost\|127\.0\.0\.1)(:\d+)?$` | Regex for any local port |
| `HOST` | `127.0.0.1` | uvicorn bind address |
| `PORT` | `8000` | uvicorn bind port |
| `FRONTEND_APP_URL` | `http://localhost:3000` | Redirect target post-login |
| `OAUTH_NEXT_PATH_ALLOWLIST` | (see .env.example) | Allowed `?next=` paths |
| `ESIGNET_BASE_URL` | `http://localhost:8088` | Used for logging/discovery |
| `ESIGNET_ISSUER` | `http://localhost:8088` | Expected `iss` in ID tokens |
| `ESIGNET_AUTHORIZATION_ENDPOINT` | `…/authorize` | OAuth2 authorize URL |
| `ESIGNET_TOKEN_ENDPOINT` | `…/oauth/v2/token` | Token exchange URL |
| `ESIGNET_USERINFO_ENDPOINT` | `…/oidc/userinfo` | Userinfo URL |
| `ESIGNET_JWKS_URI` | `…/.well-known/jwks.json` | JWKS for ID token verification |
| `ESIGNET_CLIENT_ID` | — | **Required:** the registered client id |
| `ESIGNET_REDIRECT_URI` | `…/auth/esignet/callback` | Must match eSignet registration |
| `ESIGNET_SCOPES` | `openid profile email phone` | Requested OIDC scopes |
| `ESIGNET_VCI_OTP` | `111111` | OTP used for the local browserless credential-token flow |
| `ESIGNET_VCI_OTP_CHANNELS` | `email,phone` | OTP channels requested for the local VCI flow |
| `ESIGNET_PRIVATE_KEY_PATH` | — | **Required:** RSA PEM path |
| `ESIGNET_PRIVATE_KEY_KID` | — | Optional JOSE `kid` header |
| `ESIGNET_CLIENT_ASSERTION_ALG` | `RS256` | `private_key_jwt` signing alg |
| `INJI_CERTIFY_ENABLE` | `false` | Toggle VC issuance endpoints |
| `INJI_CERTIFY_BASE_URL` | `http://127.0.0.1:8090` | Certify service URL |
| `INJI_CERTIFY_IDENTIFIER` | `http://certify-nginx:80` | Proof JWT audience / credential issuer identifier expected by Certify |
| `INJI_CERTIFY_ISSUER_ID` | — | Issuer label stored with SafeRide credential records |
| `INJI_CERTIFY_OPERATOR_CREDENTIAL_TEMPLATE` | `SafeRideDriverCredential` | Certify config id for driver VC issuance |
| `INJI_CERTIFY_OPERATOR_ISSUE_PATH` | `/v1/certify/issuance/credential` | Relative issue path under `INJI_CERTIFY_BASE_URL` |
| `INJI_CERTIFY_CREDENTIAL_ISSUER_PATH` | `/v1/certify` | Relative OpenID4VCI credential issuer path |
| `INJI_WEB_BASE_URL` | `http://localhost:3004` | Local Inji Web wallet UI |
| `CONSENT_REQUEST_TTL_MINUTES` | 15 | Consent request expiry |
| `DISCLOSURE_TOKEN_TTL_MINUTES` | 60 | Extended-tier token TTL |
| `SIM_EMERGENCY_SMS_RECIPIENTS` | — | Comma MSISDNs for panic SMS sim |
| `ADMIN_BOOTSTRAP_SECRET` | — | One-time admin bootstrap secret |

---

### Frontend environment (`.env` / `.env.local` at repo root)

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000     # FastAPI backend
APP_URL=http://localhost:3000                   # Next.js public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000       # Used in QR codes / badges
GEMINI_API_KEY=                                 # Optional — only if using AI features
DISABLE_HMR=false                               # Set true when an external agent edits files
```

> **Important:** Always use a consistent hostname (`127.0.0.1` or `localhost`) between `NEXT_PUBLIC_API_URL` and `ESIGNET_REDIRECT_URI` in the backend `.env`. eSignet validates the redirect URI exactly, so a mismatch (`localhost` vs `127.0.0.1`) will cause a token exchange failure.

---

### Installing dependencies

```bash
# From saferide/ repo root:
make install
# expands to:
#   cd backend && uv sync     (installs Python deps into .venv)
#   npm install               (installs Node deps)
```

**Python dependencies** (from `backend/pyproject.toml`):

| Package | Purpose |
|---------|---------|
| `fastapi>=0.135.1` | Web framework |
| `uvicorn>=0.42.0` | ASGI server |
| `sqlmodel>=0.0.37` | SQLAlchemy ORM + Pydantic |
| `pydantic-settings>=2.7.0` | Settings from env |
| `pyjwt>=2.10.0` | JWT sign/verify |
| `cryptography>=44.0.0` | RSA key ops, PKCE |
| `httpx>=0.28.0` | Async HTTP for eSignet/Inji calls |
| `psycopg[binary]>=3.1.0` | PostgreSQL driver (optional) |

---

### Running the application

#### Development (recommended)

```bash
# Start both backend and frontend together:
make dev

# Or separately in two terminals:
make backend    # FastAPI on 127.0.0.1:8000 with --reload
make frontend   # Next.js on localhost:3000 with HMR
```

Override ports if needed:

```bash
make backend BACKEND_HOST=0.0.0.0 BACKEND_PORT=9000
```

#### Backend (`make backend`) details

Runs:
```bash
cd backend && uv run python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8000 \
  --reload --access-log --log-level debug --use-colors
```

On startup:
1. Loads settings from `backend/.env`.
2. Calls `init_db()` → `SQLModel.metadata.create_all()` (creates all tables if missing).
3. On SQLite, runs `ensure_sqlite_columns()` to `ALTER TABLE ADD COLUMN` for any new columns not yet in an existing DB file.

#### Next.js config highlights (`next.config.ts`)

- `output: 'standalone'` — self-contained output for production Docker images.
- `transpilePackages: ['motion']` — bundled with the app.
- `DISABLE_HMR=true` in `.env` disables Webpack file-watching (useful when an external agent is editing files to prevent HMR churn).
- Remote image pattern: `picsum.photos` allowed for placeholder images.

---

## Complete startup sequence

Start everything in this order:

```bash
# 1. Shared Docker network (once)
docker network create mosip_network

# 2. eSignet stack (Postgres + Redis + mock-identity + eSignet + UI)
cd /home/kofivi/SAFERIDE/esignet/docker-compose
docker compose up -d

# 3. Wait for eSignet to be healthy (~60s first boot)
curl http://localhost:8088/v1/esignet/actuator/health

# 4. Register SafeRide OIDC client (once per clean keystore)
./register_saferide_client.sh

# 5. Inji Certify stack
cd /home/kofivi/SAFERIDE/inji/docker-compose/docker-compose-injistack
docker compose up -d

# 6. SafeRide backend + frontend
cd /home/kofivi/SAFERIDE/saferide
make install   # first time only
make dev
```

---

## Database

### Default: SQLite (zero-config)

`backend/.env` → `DATABASE_URL=sqlite:///./saferide.db`

SQLite file is created at `backend/saferide.db` on first run. `create_all` handles schema creation. `ensure_sqlite_columns()` handles `ALTER TABLE ADD COLUMN` for columns added after initial creation (no Alembic migrations needed for dev).

### Optional: PostgreSQL

Set:
```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/saferide
```

Create the database first:
```bash
createdb saferide
# or using docker:
docker exec -it <postgres-container> psql -U postgres -c "CREATE DATABASE saferide;"
```

The `saferide` database on Inji's Postgres (`localhost:5433`) is what Certify's `certify-saferide.properties` points to. If you want Certify to read SafeRide operator data, use the Inji stack's Postgres instance:
```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/saferide
```

**Note:** No Alembic — `create_all` on startup. Adding new columns to existing SQLite DBs uses the `sqlite_schema.py` helper (manual `ALTER TABLE`). For PostgreSQL, `create_all` adds missing tables but not missing columns; use `CREATE TABLE IF NOT EXISTS` or Alembic when needed.

---

## Backend API reference

### Health & ops

- `GET /health` — Liveness/readiness probe: checks API and DB.

### Auth & session

- `GET /auth/esignet/login` — Start OIDC flow (PKCE + state). Optional `?next=` (allowlist validated). `?response_mode=json` returns the auth URL payload instead of redirecting.
- `GET /auth/esignet/callback` — Default: `302` to `FRONTEND_APP_URL/path#access_token=…&role=…`. JSON mode returns auth payload.
- `GET /auth/me` — Bearer SafeRide JWT → operator profile + role.
- `POST /auth/admin/bootstrap` — Bootstrap first `system_admin` (requires `ADMIN_BOOTSTRAP_SECRET`).
- `POST /auth/admin/login` — Staff local login (email + password).
- `POST /auth/rider/login` — Rider daily login (phone + password; eSignet remains for onboarding).
- `POST /auth/admin/users` — Create staff users (system_admin only; roles: `monitor|support|officer|driver|admin|system_admin`).
- `POST /operators/enroll` — Officer enrolls a transport-side identity (`driver` or `passenger`).
- `POST /operators/onboarding/esignet/start` — Start officer-led eSignet onboarding for a new driver under the officer's corporate body.
- `POST /operators/{id}/onboarding/esignet/start` — Start passenger eSignet verification.

### Operators, fleet, public verify

- `GET /operators` — List (officer/admin). Query: `status`, `q`, `limit`.
- `GET /operators/{id}` — Read (self or officer/admin).
- `PATCH /operators/{id}/status` — Set status: `PENDING|APPROVED|ACTIVE|SUSPENDED|EXPIRED`. Allocates `verify_short_code` on `APPROVED`/`ACTIVE`.
- `GET /operators/{id}/vehicle-bindings` — List bindings.
- `POST /operators/{id}/vehicle-bindings` — Bind vehicle (officer/admin).
- `GET /vehicles`, `POST /vehicles`, `GET /vehicles/{id}` — Vehicle registry (officer/admin).
- `PATCH /bindings/{binding_id}` — `{ "is_active": false }` to unbind.
- `GET /public/trust/{code}` — No auth. Tier: `minimal|standard|extended`. Extended requires `disclosure_token`.
- `POST /public/consent/request`, `GET /public/consent/status/{request_id}` — Passenger consent flow (no auth).
- `GET/POST /auth/me/consent-requests` — Driver views/responds to pending consent requests (Bearer).
- `POST /public/emergency/share` — Panic share (no auth) → simulated SMS to `SIM_EMERGENCY_SMS_RECIPIENTS`.
- `POST /public/report` — Incident report (no auth) → stored + simulated SMS.
- `POST /public/simulate/ussd`, `GET/POST /public/simulate/sms` — Lab simulators (no auth).

### Corporate bodies

- `POST /corporate-bodies` — Create (system_admin).
- `POST /corporate-bodies/{id}/officers/{officer_id}` — Attach officer (system_admin).
- `GET /corporate-bodies`, `GET /corporate-bodies/{id}/officers` — Read.
- `POST /auth/officers/users` — Officer creates fellow officers under their corporate body.

### Credentials (Inji Certify)

Requires `INJI_CERTIFY_ENABLE=true`:

- `POST /credentials/issue/operator/{id}` — Issue operator VC (officer/admin; operator must be APPROVED/ACTIVE, eSignet-verified, and have `individual_id` on the canonical SafeRide operator row).
- `POST /credentials/issue/vehicle/{operator_id}/{vehicle_id}` — Issue vehicle-binding VC.
- `GET /credentials/{id}` — Retrieve issued credential record.

### RBAC roles

| Role | Home path | Auth method |
|------|-----------|------------|
| `passenger` | `/rider/status` | eSignet onboarding |
| `driver` | `/driver/profile` | eSignet (default for new IdP signups) |
| `officer` | `/portal` | Local staff login |
| `admin` | `/admin` | Local staff login |
| `monitor` | `/admin` (read-only) | Local staff login |
| `support` | `/portal` (read-only) | Local staff login |
| `system_admin` | `/admin` (superuser) | Local staff login |

---

## Frontend pages

| Route | Description |
|-------|-------------|
| `/` | Marketing home |
| `/login` | Role cards + eSignet link + optional token paste (debug) |
| `/driver/profile` | Driver: `/auth/me`, vehicle bindings, QR badge, consent requests |
| `/driver/consent` | Driver: pending consent approval |
| `/verify/result/[id]` | Passenger: scan QR / type short code → trust card |
| `/report` | Passenger: submit incident report |
| `/portal` | Officer: operator list, approvals, vehicle binding |
| `/portal/incidents` | Officer: reports and incidents |
| `/admin` | Admin: full operator/staff management |
| `/admin/audit` | Admin: consent audit trail |
| `/admin/incidents` | Admin: emergency shares + reports |
| `/simulate/ussd` | Lab: USSD simulator UI |
| `/simulate/sms` | Lab: SMS outbox viewer |
| `/offline` | Offline/low-bandwidth info page |
| `/how-it-works` | Public explainer |
| `/privacy` | Privacy policy |

**Root layout** includes `OauthFragmentHandler` which picks up `#access_token=…&role=…` from the URL hash after eSignet callback and stores the token for subsequent API calls.

---

## eSignet integration — technical detail

### Flow: Authorization Code + PKCE + private_key_jwt

```
Browser/Client       SafeRide Backend            eSignet
     |                      |                       |
     | GET /auth/esignet/login                       |
     |---------------------->|                       |
     |                      | generate state (HMAC-signed, TTL 600s)
     |                      | generate code_verifier + code_challenge (S256)
     |                      | store state → in-memory state store
     | 302 → eSignet        |                       |
     |<---------------------|                       |
     |                                              |
     | [user authenticates in eSignet UI]            |
     |                                              |
     | GET /auth/esignet/callback?code=…&state=…     |
     |---------------------->|                       |
     |                      | verify state (HMAC + TTL)
     |                      | POST /oauth/v2/token   |
     |                      | client_assertion=private_key_jwt (RS256)
     |                      | code_verifier=…        |
     |                      |----------------------->|
     |                      | {id_token, access_token}|
     |                      |<-----------------------|
     |                      | verify id_token against JWKS
     |                      | upsert Operator row    |
     |                      | issue SafeRide JWT     |
     | 302 → FRONTEND#access_token=…&role=…          |
     |<---------------------|
```

### State store

In-memory `OauthStateStore` (10 min TTL, HMAC-signed). Redis-swappable for multi-instance deployments.

### ID token verification

- JWKS fetched from `ESIGNET_JWKS_URI` and cached.
- Verifies `iss`, `aud`, `exp`, nonce, and RS256 signature.
- Claims extracted: `sub`, `name`, `email`, `phone_number`, `gender`, `birthdate`, `picture`.

---

## Inji Certify integration — technical detail

### SafeRide credential scope: `saferide_driver_vc_ldp`

SafeRide intentionally uses two different scope layers:

- Login/OIDC scope:
  - `openid profile email phone`
- Credential/VCI scope:
  - `saferide_driver_vc_ldp`

The backend keeps these separate. Normal login uses `ESIGNET_SCOPES`, while VC issuance mints a second credential-scoped token plus `c_nonce` specifically for Certify.

The Certify Postgres plugin executes this query when a driver requests their VC:

```sql
SELECT
  o.individual_id     AS "id",
  o.full_name         AS "fullName",
  o.phone             AS "mobileNumber",
  o.birthdate         AS "dateOfBirth",
  o.gender            AS "gender",
  o.status            AS "operatorStatus",
  o.verify_short_code AS "operatorCode",
  v.external_ref      AS "vehiclePlate",
  v.make_model        AS "vehicleMakeModel",
  v.vehicle_type      AS "vehicleType",
  v.color             AS "vehicleColor"
FROM public.operators o
LEFT JOIN public.operator_vehicle_bindings b ON b.operator_id = o.id AND b.is_active = true
LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
WHERE (o.external_subject_id = :id OR o.individual_id = :id)
  AND o.status IN ('APPROVED', 'ACTIVE')
LIMIT 1
```

Certify validates the credential-scoped access token, then uses its subject to resolve the SafeRide operator row. In practice this means:

- after eSignet login, the subject may be a hashed external subject id
- SafeRide must reconcile that identity onto the canonical operator row
- Certify then resolves the same canonical row, including vehicle binding and `individual_id`

### Issuer DID

`did:web:localhost` (local dev). For production, expose `certify-nginx` publicly and update `mosip.certify.data-provider-plugin.did-url`.

### Enable issuance

```env
# backend/.env
INJI_CERTIFY_ENABLE=true
INJI_CERTIFY_BASE_URL=http://127.0.0.1:8090
INJI_CERTIFY_IDENTIFIER=http://certify-nginx:80
INJI_CERTIFY_ISSUER_ID=SafeRide
INJI_CERTIFY_OPERATOR_CREDENTIAL_TEMPLATE=SafeRideDriverCredential
INJI_CERTIFY_OPERATOR_ISSUE_PATH=/v1/certify/issuance/credential
INJI_CERTIFY_CREDENTIAL_ISSUER_PATH=/v1/certify
INJI_WEB_BASE_URL=http://localhost:3004
```

---

## End-to-end verification flow

### Channel A — Web / QR (smartphone)

```
PASSENGER                        SAFERIDE BACKEND                   DRIVER APP
    |                                    |                                |
    | 1. Scan QR / type short code       |                                |
    |---------------------------------->|                                |
    |                                    | GET /public/trust/{code}       |
    |  2. MINIMAL trust card             | tier=minimal                   |
    |<----------------------------------|   name: "A. M***", status,     |
    |                                    |   trust_band, vehicles         |
    |                                    |                                |
    | 3. Tap "Request verified details"  |                                |
    |---------------------------------->| POST /public/consent/request   |
    |  4. Gets request_id               |   → ConsentRequest row         |
    |<----------------------------------|   → sim SMS to driver          |
    |                                    |                                |
    |  [polls /public/consent/status]    | 5. Driver sees request        |
    |                                    |   GET /auth/me/consent-requests|
    |                                    |                                |
    |                                    | 6. Driver approves             |
    |                                    |   POST …/respond {approved}   |
    |                                    |   → disclosure_token issued    |
    |                                    |   → consent_audit_entry        |
    |                                    |                                |
    |  7. Poll: approved + token         |                                |
    |<----------------------------------|                                |
    |                                    |                                |
    | 8. GET /public/trust/{code}        |                                |
    |    tier=extended&disclosure_token=…|                                |
    |  9. Full name, phone, verified ts  |                                |
    |<----------------------------------|                                |
    |                                    |                                |
    | [optional] Tap "Panic share"       |                                |
    |---------------------------------->| POST /public/emergency/share   |
    |  Ref ID                           |   → sim SMS                    |
    |<----------------------------------|   → logged as 'panic'          |
```

### Channel B — USSD / feature phone

```
PASSENGER (feature phone)        USSD SIMULATOR           SAFERIDE BACKEND
    |                                  |                           |
    | Dial *XXX# or use /simulate/ussd |                           |
    |--------------------------------->|                           |
    |                                  | POST /public/simulate/ussd|
    |  CON SafeRide                    |   msisdn, session_id, input
    |  1 Verify driver                 |                           |
    |  2 Panic share                   |                           |
    |  3 Request more detail           |                           |
    |<---------------------------------|                           |
    |                                  |                           |
    | Press 1 → Enter short code       |                           |
    | Type SR-XXXX                     |                           |
    |--------------------------------->| get_trust_public(tier=minimal)
    |  END: Ali M.|ACTIVE|KAA 123X|CLEAR                          |
    |<---------------------------------| + log_sim_sms(tag="ussd") |
```

---

## What gets logged (audit trail)

| Event | Table | Admin view |
|-------|-------|------------|
| Driver verified (USSD) | `sim_sms` (tag=`ussd`) | `/admin/incidents` + `/admin/audit` |
| Consent requested | `consent_requests` + `sim_sms` (tag=`consent`) | `/admin/audit` |
| Consent approved/denied | `consent_audit_entries` | `/admin/audit` |
| Panic shared | `emergency_shares` + `sim_sms` (tag=`panic`) | `/admin/incidents` |
| Report submitted | `public_incident_reports` + `sim_sms` (tag=`report`) | `/portal/incidents` + `/admin/incidents` |

---

## Troubleshooting

### eSignet `No such alias` on startup

Stale key aliases in the database from a previous keystore. Fix:

```bash
cd /home/kofivi/SAFERIDE/esignet/docker-compose
./reset_esignet_keys.sh
```

### eSignet redirect URI mismatch

Ensure all three values are identical (same scheme, host, port, path):
- `ESIGNET_REDIRECT_URI` in `backend/.env`
- `redirect_uri` in the client registration (sent by `register_saferide_client.sh`)
- `redirect_uri` in `mimoto-issuers-config.json` under the SafeRide issuer

### `mosip_network` not found

```bash
docker network create mosip_network
# then re-start the affected stack
docker compose up -d
```

### Certify fails with `Connection refused` to SafeRide DB

Check that `certify-saferide.properties` uses the full container name:
```
mosip.certify.data-provider-plugin.postgres.url=jdbc:postgresql://docker-compose-injistack-database-1:5432/saferide
```
The hostname must be the full Docker container name (not just `database`), because both stacks have a service named `database` on the shared `mosip_network`.

### SQLite `no such column` error

The `sqlite_schema.py` helper runs `ALTER TABLE ADD COLUMN` on startup. If it fails, delete `backend/saferide.db` and restart — `create_all` recreates the schema fresh.

### Apple Silicon (linux/amd64 emulation)

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
docker compose up -d
```

### DID verification failure in Inji Web / Mimoto

The DID multibase hash changes on every fresh Certify start. After restarting the Certify stack, verify the DID is resolvable:

```bash
curl http://localhost:8090/v1/certify/.well-known/did.json
curl http://localhost:8091/.well-known/did.json
```

If the hash has changed, the `credential_config` table in the DB needs updating (or use `did:web:localhost` consistently and ensure `certify-nginx` is resolving it).

---

## Makefile targets

| Target | Action |
|--------|--------|
| `make help` | Print available targets |
| `make install` | `uv sync` (backend) + `npm install` (frontend) |
| `make backend` | Uvicorn with `--reload` + debug logs |
| `make frontend` | `npm run dev` |
| `make dev` | Backend + frontend together (Ctrl+C stops both) |

Override: `make backend BACKEND_HOST=0.0.0.0 BACKEND_PORT=9000`

---

## Inji stack integration status

| Component | Role in SafeRide | Status |
|-----------|-----------------|--------|
| **eSignet** | Driver identity verification at onboarding — issues `esignet_verified_at` | Working |
| **Inji Certify** | Issues W3C VC for driver badge (Postgres plugin wired to SafeRide DB) | Running — SafeRide backend aligned to `SafeRideDriverCredential` |
| **Inji Web** | Web UI for credential download (SafeRide issuer configured in mimoto-issuers-config.json) | Running on :3004 |
| **Inji Wallet** | Driver holds VC on device, presents QR for offline verification | Driver profile now exposes wallet claim QR / deep link |
| **Inji Verify** | Passenger scans driver Wallet QR — cryptographic VC verification | Next step — replace trust-band lookup |

---

## Roadmap & TODO backlog

### Priority 1 — Golden path (demo-ready)

- [x] eSignet OIDC login (Authorization Code + PKCE + `private_key_jwt` + JWKS verification)
- [x] Driver onboarding (eSignet → upsert operator → officer approval → short code)
- [x] Vehicle binding (registry + operator ↔ vehicle bindings; QR on driver profile)
- [x] Public trust verification (`GET /public/trust/{code}` with 3-tier disclosure)
- [x] Consent unlock (passenger requests → driver approves → disclosure token → extended tier)
- [x] Panic share (unauthenticated emergency share → simulated SMS → admin incidents)
- [x] USSD simulator (full menu: verify / panic / consent, wired to live backend)
- [x] QR badge (encodes `/verify/result/{short_code}`; shown on driver profile)
- [x] Inji Certify stack running (certify:8090, certify-nginx:8091, mimoto:8099, inji-web:3004)
- [x] SafeRide Postgres data provider (certify-saferide.properties queries operators table)
- [x] SafeRide issuer in mimoto-issuers-config.json (client_id, endpoints, credential_issuer_host)
- [x] Enable Inji Certify issuance (`INJI_CERTIFY_ENABLE=true`; SafeRide backend aligned to the Certify issuance endpoint + credential type)
- [ ] Ride/trip log (`ride_events` table; write record on consent approval)
- [ ] Driver consent notification (real-time badge count in sidebar)

### Priority 2 — Inji Wallet + Verify

- [x] Inji Wallet delivery (driver profile renders backend-generated claim QR / deep link after VC issuance)
- [ ] Inji Verify on passenger side (replace trust-band DB lookup with cryptographic VC proof)
- [ ] Offline QR flow (driver shows Wallet VC QR; passenger scans with Inji Verify; no network needed)

### Priority 3 — Governance & operations

- [x] Officer/admin dashboards (operator lists, detail, bind/unbind; RoleGate on layouts)
- [x] Corporate body scoping (officers see only their body's operators; system_admin sees all)
- [ ] Role elevation UI (secure admin page to assign officer/admin without DB access)
- [ ] Incident action wiring ("Mark Under Review", "Suspend", "Add Note" — currently UI stubs)
- [ ] SACCO / authority workflow

### Priority 4 — Channels & inclusion

- [x] Short-code lookup (no-auth REST + USSD + web verify page)
- [ ] Real carrier USSD/SMS (Africa's Talking or equivalent; keep simulator for tests)
- [ ] NFC tap-to-verify
- [ ] Offline / low-bandwidth (Wallet-held VC works offline)

### Priority 5 — Engineering hardening

- [ ] Postgres + Alembic migrations (replace SQLite `create_all`)
- [ ] Persistent audit table (dedicated `audit_log` vs synthesising from SMS/operator rows)
- [ ] HTTPS + cookie hardening + secrets management (before production)
- [ ] Inji Certify credential schema (SafeRide-specific VC context; publish DID document publicly)

---

## Optional: Gemini / Google GenAI

Set `GEMINI_API_KEY` in the root `.env` to enable AI-assisted features. Separate from eSignet/Inji.

---

## Related docs

- [STATUS.md](./STATUS.md) — which UI routes call which APIs
- [PROGRESS.md](./PROGRESS.md) — prototype vs full product maturity
- [TECHNICAL_NOTES.md](./TECHNICAL_NOTES.md) — reviewer feedback triage, architecture notes
- [Inji stack README](../inji/docker-compose/docker-compose-injistack/README.md) — full Inji setup reference
