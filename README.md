# SafeRide

Digital trust platform for informal transport: **Next.js** frontend, **FastAPI** backend, **MOSIP eSignet** for operator authentication, and scaffolding for **Inji Certify** verifiable credentials.

---

## Current state (summary)

| Area | Status |
|------|--------|
| **Web UI** | Next.js 16 app with marketing pages, driver/portal/admin shells, verify/report flows. Much content is **demo/mock data** until APIs are extended. |
| **Backend API** | FastAPI + SQLModel + SQLite by default. OpenAPI at `/docs` when the server is running. |
| **Operator auth** | **eSignet OIDC** (authorization code): login → IdP → callback → SafeRide JWT + operator row. |
| **RBAC** | Operators have a **`role`** (`passenger` \| `driver` \| `officer` \| `admin`). Post-login redirect uses role home + optional allowlisted `?next=` (validated so roles cannot hop to another role’s shell). |
| **Frontend ↔ API** | `NEXT_PUBLIC_API_URL` drives fetch + eSignet link. OAuth returns to the SPA with **`#access_token=…`**; `OauthFragmentHandler` stores the token and **`/auth/me`** loads the session. |
| **Inji Certify** | **Issuance service + routes exist**; HTTP payload paths are **placeholders** until aligned with your Inji deployment. Disabled by default (`INJI_CERTIFY_ENABLE=false`). |
| **Database** | **No Alembic** — `create_all` on startup. Adding columns (e.g. `operators.role`) may require a fresh SQLite file or manual `ALTER` on existing DBs. |

**More detail:** [STATUS.md](./STATUS.md) (which pages call which APIs), [PROGRESS.md](./PROGRESS.md) (prototype vs full product / judge-facing summary).

---

## Repository layout

```
saferide/
├── app/                    # Next.js App Router (pages, layouts)
├── components/             # UI + shared components
├── hooks/                  # e.g. use-operator-session (calls /auth/me)
├── lib/api/                # API base URL, fetch helpers, types
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (auth, credentials, operators)
│   │   ├── core/           # config, security (JWT), rbac, logging
│   │   ├── db/models/      # Operator, Vehicle, binding, Credential
│   │   ├── middleware/     # Request logging
│   │   ├── schemas/      # Pydantic response models
│   │   └── services/       # eSignet, Inji, credential business logic
│   ├── main.py             # Optional uvicorn entry
│   ├── pyproject.toml      # uv / Python deps
│   └── .env                # Backend secrets (not committed)
├── Makefile                # install, backend, frontend, dev
├── .env / .env.example     # Frontend env (GEMINI, NEXT_PUBLIC_API_URL, …)
├── STATUS.md               # UI routes vs backend wiring
├── PROGRESS.md             # Maturity vs product submission
└── README.md               # This file
```

---

## Prerequisites

- **Node.js** (see your toolchain; Next 16 is in use)
- **Python 3.13+** and **[uv](https://github.com/astral-sh/uv)** for the backend
- Running **eSignet** (or equivalent OIDC) if you exercise real login
- Optional: **Inji Certify** when you enable issuance

---

## Quick start

From the **repo root**:

```bash
make install    # uv sync (backend) + npm install (frontend)
make dev        # uvicorn + next dev (Ctrl+C stops both)
```

Or separately:

```bash
make backend    # API on BACKEND_HOST:BACKEND_PORT (default 127.0.0.1:8000)
make frontend   # Next.js (default http://localhost:3000)
```

### Environment files

| File | Purpose |
|------|---------|
| **`backend/.env`** | API: `SECRET_KEY`, eSignet URLs/client/keys, `FRONTEND_APP_URL`, CORS, Inji flags, DB URL. Copy from `backend/.env.example`. |
| **`.env`** or **`.env.local`** (root) | `NEXT_PUBLIC_API_URL` (must match API origin), `GEMINI_API_KEY` if you use Gemini features, `APP_URL`. See root `.env.example`. |

Use a **consistent host** for the API in the browser (e.g. always `127.0.0.1` or always `localhost`) so eSignet cookies and redirects line up with `ESIGNET_REDIRECT_URI`.

---

## Backend API (high level)

### Auth & session

- **`GET /auth/esignet/login`** — Starts OIDC; optional **`?next=`** (allowlisted path). Sets signed OAuth cookie.
- **`GET /auth/esignet/callback`** — Default: **302** to `FRONTEND_APP_URL` + path + **`#access_token=…&role=…`**. **`?response_mode=json`** returns JSON (e.g. for curl).
- **`GET /auth/me`** — Bearer SafeRide JWT → operator profile + **`role`**.

JWT is issued by SafeRide (not eSignet); it includes **`sub`** (operator id) and **`role`**.

### RBAC

- **`Operator.role`**: `passenger` | `driver` | `officer` | `admin` (default **`driver`** for new IdP signups).
- **Home redirects**: `/`, `/driver/profile`, `/portal`, `/admin` respectively.
- **Elevating** users to officer/admin is **not** in the UI yet — set `operators.role` to `officer` or `admin` in the DB (or add an admin API when ready). The **portal** and **admin** layouts require these roles.

### Operators, fleet, public verify

- **`GET /operators`** — List operators (Bearer **officer** or **admin**). Query: `status`, `q`, `limit`.
- **`GET /operators/{id}`** — Read operator (Bearer: **self** or officer/admin).
- **`PATCH /operators/{id}/status`** — Set trust status: `PENDING` \| `APPROVED` \| `ACTIVE` \| `SUSPENDED` \| `EXPIRED` (officer/admin). Allocates **`verify_short_code`** when entering `APPROVED`/`ACTIVE`.
- **`GET /operators/{id}/vehicle-bindings`** — List bindings (self or officer/admin).
- **`POST /operators/{id}/vehicle-bindings`** — Bind a vehicle (officer/admin). Body: `{ "vehicle_id": "<uuid>" }`.
- **`GET /vehicles`**, **`POST /vehicles`**, **`GET /vehicles/{id}`** — Vehicle registry (officer/admin). POST body: `{ "plate": "...", "display_name": "..." }`.
- **`PATCH /bindings/{binding_id}`** — `{ "is_active": false }` to unbind (officer/admin).
- **`GET /public/trust/{code}`** — **No auth.** Query `tier=minimal|standard|extended` and optional `disclosure_token` (extended). Response includes `disclosure_tier`, optional `phone` / `esignet_verified_at` when extended + valid token.
- **`POST /public/consent/request`**, **`GET /public/consent/status/{request_id}`** — **No auth** passenger side; driver approves via **`GET/POST /auth/me/consent-requests`** (Bearer).
- **`POST /public/emergency/share`** — **No auth.** Panic summary + simulated SMS to **`SIM_EMERGENCY_SMS_RECIPIENTS`**.
- **`POST /public/report`** — **No auth.** Stores report; optional simulated SMS to same recipient list.
- **`POST /public/simulate/ussd`**, **`GET/POST /public/simulate/sms`** — **No auth** lab endpoints (USSD state machine + SMS outbox).

### Credentials

- **`POST /credentials/issue/operator/{id}`**, **`POST /credentials/issue/vehicle/{operator_id}/{vehicle_id}`**, **`GET /credentials/{id}`** — Inji-backed issuance when enabled; business rules require verified operator and `APPROVED`/`ACTIVE` status for issuance.

### Integrations

- **eSignet**: `app/services/esignet_service.py` — authorize URL, token exchange (optional `private_key_jwt`), userinfo, JWT/JSON parsing (TODOs for full JWKS/audience hardening).
- **Inji Certify**: `app/services/inji_certify_service.py` — placeholder POST bodies and response normalization; tune to your OpenAPI.

---

## Frontend (high level)

- **Login** (`/login`): role cards, **eSignet** link (with `?next=` when a role is selected), optional manual token paste for debugging.
- **Root layout**: **`OauthFragmentHandler`** picks up hash tokens after redirect.
- **Driver profile**: **`/auth/me`**, vehicle bindings, QR, pending **consent** requests (`/auth/me/consent-requests`).
- **Simulators**: **`/simulate/ussd`**, **`/simulate/sms`** (no login; hit public API).

---

## Makefile targets

| Target | Action |
|--------|--------|
| `make help` | Print targets |
| `make install` | `uv sync` in `backend/` + `npm install` at root |
| `make backend` | Uvicorn with reload + debug logs |
| `make frontend` | `npm run dev` |
| `make dev` | Backend and frontend together |

Override **`BACKEND_HOST`** / **`BACKEND_PORT`** if needed.

---

## Roadmap & tasks (TODO)

This list merges **engineering gaps** (previously under “Known gaps”) with **product submission** work described in [PROGRESS.md](./PROGRESS.md). Items are unchecked until shipped.

### Comparison (what README already said vs submission scope)

| Source | Focus |
|--------|--------|
| **Earlier README “gaps”** | Production hardening, JWKS/Inji alignment, admin UX, replacing mocks, optional OAuth code flow. |
| **Product / submission** | End-to-end trust path: real VC issuance, passenger verification with minimal trust facts, multi-channel access (QR/NFC/SMS/USSD/voice/short-code), consent unlock, panic share, SACCO/authority governance, wallet/signed badge/offline verify. |

The sections below **deduplicate** those into one backlog.

### Milestone 1 — Finish the real golden path (highest priority)

- [x] **eSignet login** — Present; deep-link `next=` now allows `/portal/*`, `/admin/*`, `/driver/*` subpaths.
- [x] **Operator approval** — `PATCH /operators/{id}/status` + officer/admin UI (portal detail + lists). Short code issued on `APPROVED`/`ACTIVE`.
- [x] **Vehicle binding** — `POST /vehicles`, `POST /operators/{id}/vehicle-bindings`, driver reads bindings; issuance still requires active binding + eligible status.
- [ ] **Real Inji Certify issuance** — Replace placeholder payloads/paths; enable in env; map fields to your deployment; persist credential references.
- [x] **QR badge generation** — QR encodes app URL `/verify/result/{short_code}` (not yet a signed VC / wallet badge).
- [x] **Verifier screen** — `/verify/result/[id]` calls **`GET /public/trust/{code}`** (minimal facts + `trust_band`). Not VC-crypto verification yet.

### Milestone 2 — Trust-status operations (governance)

- [x] **States** — `PENDING` / `APPROVED` / `ACTIVE` / `SUSPENDED` / `EXPIRED` in API + UI (enforcement is role/status based, not full policy engine).
- [x] **Officer/admin dashboard** — Live **portal** + **admin** operator lists, operator detail (status + bind/unbind), **portal/vehicles** registry; **RoleGate** on layouts.
- [ ] **SACCO / authority workflows** — Still generic officer/admin; tailor when requirements are fixed.

### Milestone 3 — Minimal trust facts (privacy by default)

- [x] **Disclosure policy** — `tier=minimal` masks name, omits photo/phone/operator_id; `standard` is web default; `extended` adds phone + verified timestamp + masked subject **after** operator consent.
- [x] **Consent / unlock** — `POST /public/consent/request` → poll **`/public/consent/status/{id}`** → driver **`/auth/me/consent-requests`** + respond → disclosure token; **audit** rows in `consent_audit_entries`.
- [x] **Separate API shapes** — Single `TrustPublicResponse` with `disclosure_tier` and conditional fields.

### Milestone 4 — One low-resource verification channel

- [x] **Short-code trust lookup** — **`GET /public/trust/{code}`** + verify result page.
- [x] **USSD + SMS (simulated)** — **`POST /public/simulate/ussd`** (menu: verify / panic / consent) + **`GET/POST /public/simulate/sms`** outbox; **no auth** (lab only).
- *Later:* Real carrier integrations, voice hotline, human/stage verification.

### Milestone 5 — Emergency / panic share

- [x] **One-tap share** — **`POST /public/emergency/share`** (no auth) + simulated SMS; also triggered from USSD menu **2**.
- [x] **Wire to report flow** — **`/report`** submits **`POST /public/report`** + optional simulated SMS to configured recipients.

### Multi-channel & inclusion (submission-sized backlog)

- [ ] NFC tap-to-verify flow
- [ ] Offline verification support (where feasible)
- [ ] Wallet integration (operator-held VC) and **Inji Verify**-class lightweight verifier

### Complete partial work (already started)

- [x] **Driver profile** — Vehicle tab + QR from **bindings** + **verify_short_code**; scan history still mock.
- [x] **Verify / report** — Result page: tiers + consent + panic; **`/report`** → **`POST /public/report`**.
- [x] **Portal / admin** — Live operator + vehicle tables where noted; **RoleGate** enforces role from `/auth/me`.
- [ ] **Role elevation** — Secure way to assign `officer` / `admin` (today: DB-only).

### Engineering hardening (cross-cutting)

- [ ] HTTPS-only cookies, stricter CORS, secrets management
- [ ] Postgres + migrations (e.g. Alembic) instead of ad-hoc SQLite schema changes
- [ ] eSignet JWT verification hardening (JWKS, audience checks; see backend TODOs)
- [ ] Optional OAuth: backend **one-time code** redirect instead of hash fragment for token handoff

---


## Optional: AI Studio / Gemini

If you still use Google GenAI from this repo, set **`GEMINI_API_KEY`** in the root env (see `.env.example`). This is separate from eSignet/Inji.

---

## License / product

Product positioning and any deployment-specific links belong here when you finalize them.
