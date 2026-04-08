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
| **Ops health** | Basic health probe at **`GET /health`**; request logging middleware logs method, path, status, and duration. |

**More detail:** [STATUS.md](./STATUS.md) (which pages call which APIs), [PROGRESS.md](./PROGRESS.md) (prototype vs full product / judge-facing summary), [TECHNICAL_NOTES.md](./TECHNICAL_NOTES.md) (review feedback triage, architecture notes, deployment/testing/ops guidance).

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
├── TECHNICAL_NOTES.md      # Reviewer feedback triage + technical guidance
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

### Health & ops

- **`GET /health`** — Basic liveness/readiness probe for the API and database.

### Auth & session

- **`GET /auth/esignet/login`** — Starts OIDC; optional **`?next=`** (allowlisted path). Generates state + PKCE and redirects to eSignet (`?response_mode=json` returns auth URL payload).
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

- **eSignet**: `app/services/esignet_service.py` — authorize URL, PKCE, `private_key_jwt` token exchange, JWKS-backed ID token verification, and userinfo merge.
- **Inji Certify**: `app/services/inji_certify_service.py` — placeholder POST bodies and response normalization; tune to your OpenAPI.

---

## eSignet Local Integration Setup

This backend now uses production-grade OIDC hardening for local eSignet:

- Authorization Code flow
- PKCE (`S256`)
- short-lived `state` transaction store (in-memory, swappable with Redis)
- token endpoint authentication via `private_key_jwt`
- strict ID token verification against JWKS (`iss`, `aud`, `exp`, signature, nonce)
- local SafeRide access + refresh token issuance after identity verification

### Required environment values

Set these in `backend/.env` (copy from `backend/.env.example`):

- `ESIGNET_ISSUER` (`http://localhost:8088` for local)
- `ESIGNET_AUTHORIZATION_ENDPOINT`
- `ESIGNET_TOKEN_ENDPOINT`
- `ESIGNET_USERINFO_ENDPOINT`
- `ESIGNET_JWKS_URI`
- `ESIGNET_CLIENT_ID`
- `ESIGNET_REDIRECT_URI` (must be exactly registered in eSignet)
- `ESIGNET_PRIVATE_KEY_PATH` (private key matching registered client key/JWK)
- optional `ESIGNET_PRIVATE_KEY_KID`
- optional `ESIGNET_CLIENT_ASSERTION_ALG` (`RS256` default)
- `SECRET_KEY` (or `JWT_SECRET`)

### Redirect URI registration

Register the callback URI in eSignet client configuration exactly as used by this API:

- `http://localhost:8000/auth/esignet/callback` (or your deployed callback URL)

Mismatch here causes token exchange failures.

### Docker/localhost caveat

If FastAPI runs inside Docker, `localhost` inside the container points to the container, not your host machine.
Use host-reachable DNS/IP for eSignet endpoints (for example `host.docker.internal` on compatible setups), and update all `ESIGNET_*` URLs consistently.

### Local test flow

1. Start backend:
   - `make backend`
2. Start frontend (optional for browser UX):
   - `make frontend`
3. Start auth:
   - Browser: open `http://localhost:8000/auth/esignet/login`
   - JSON mode (debug): `http://localhost:8000/auth/esignet/login?response_mode=json`
4. Authenticate in eSignet UI.
5. On callback:
   - default mode: backend redirects to frontend with token hash
   - JSON mode: callback returns local auth payload (operator + access/refresh tokens)
6. Verify local session:
   - call `GET /auth/me` with `Authorization: Bearer <access_token>`

### Internal staff/admin auth (non-eSignet)

System monitors/admins use local staff auth, not eSignet onboarding.

1. Set `ADMIN_BOOTSTRAP_SECRET` in `backend/.env` (dev bootstrap only).
2. Bootstrap first system admin (once):
   - `POST /auth/admin/bootstrap` with `email`, `password`, `full_name`, `bootstrap_secret`
3. Login staff:
   - `POST /auth/admin/login` with `email` + `password`
   - `POST /auth/rider/login` with `phone` + `password` (daily rider login; eSignet remains for onboarding verification)
4. Create additional platform users (system admin only):
   - `POST /auth/admin/users` with role `monitor|support|officer|driver|admin|system_admin`
   - rider/passenger creation is intentionally rejected on this endpoint
5. Officers onboard transport-side identities:
   - `POST /operators/enroll` with role `driver` or `passenger`
   - passenger records are created in `PENDING` until eSignet onboarding is completed
   - `POST /operators/{id}/onboarding/esignet/start` starts passenger eSignet verification
6. Corporate body lifecycle:
   - `POST /corporate-bodies` create corporate body (system_admin only)
   - `POST /corporate-bodies/{corporate_id}/officers/{officer_id}` attach officer to corporate body (system_admin only)
   - `GET /corporate-bodies` and `GET /corporate-bodies/{corporate_id}/officers`
   - `POST /auth/officers/users` creates fellow officers under the creator's corporate body

Role intent:

- `monitor`: read-only governance visibility
- `support`: operations support visibility
- `officer`: governance write actions
- `admin`: governance + management
- `system_admin`: internal superuser for staff lifecycle/security

### Known Missing Inputs

- [ ] `ESIGNET_CLIENT_ID` (actual registered client id)
- [ ] `ESIGNET_PRIVATE_KEY_PATH` (real key file path)
- [ ] Redirect URI registered in eSignet must match `ESIGNET_REDIRECT_URI`
- [ ] Decide whether `ESIGNET_PRIVATE_KEY_KID` is required by your eSignet registration
- [ ] Confirm frontend completion mode:
  - hash redirect flow (default), or
  - callback JSON handling by frontend/mobile app

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

## End-to-end verification flow

SafeRide's core loop connects a **passenger who wants to verify their driver** to a **driver who must consent**, and logs the interaction as a trust event. There are two channels: a smartphone/web path and a USSD/feature-phone path. Both share the same backend services.

---

### Channel A — Web / QR (smartphone)

```
PASSENGER                          SAFERIDE BACKEND                     DRIVER APP
    |                                      |                                  |
    | 1. Scan QR / type short code         |                                  |
    |------------------------------------->|                                  |
    |                                      |  GET /public/trust/{code}        |
    |  2. Receives MINIMAL trust card      |  tier=minimal                    |
    |<-------------------------------------|  (masked name, trust_band,       |
    |  name: “A. M***”                     |   plates — no auth needed)       |
    |  status: ACTIVE                      |                                  |
    |  trust_band: CLEAR                   |                                  |
    |  vehicles: [KAA 123X]                |                                  |
    |                                      |                                  |
    | 3. Taps “Request verified details”   |                                  |
    |------------------------------------->|                                  |
    |                                      |  POST /public/consent/request    |
    |  4. Gets request_id, told to wait    |  channel=web                     |
    |<-------------------------------------|  → creates ConsentRequest row    |
    |                                      |  → SMS sim: “New request”        |
    |  [polls every 2.5s]                  |                                  |
    |------- GET /public/consent/-----→   |                                  |
    |         status/{request_id}          |                                  |
    |                                      |  5. Driver sees pending request  |
    |                                      |----------------------------------→
    |                                      |  GET /auth/me/consent-requests   |
    |                                      |  (driver's portal / profile tab) |
    |                                      |                                  |
    |                                      |  6. Driver taps Approve          |
    |                                      |<---------------------------------|
    |                                      |  POST /auth/me/consent-requests  |
    |                                      |       /{id}/respond              |
    |                                      |  status=approved                 |
    |                                      |  → issues disclosure_token       |
    |                                      |  → writes consent_audit_entry    |
    |                                      |                                  |
    |  7. Poll returns: approved +         |                                  |
    |     disclosure_token                 |                                  |
    |<-------------------------------------|                                  |
    |                                      |                                  |
    | 8. Re-fetches trust (EXTENDED tier)  |                                  |
    |------------------------------------->|                                  |
    |                                      |  GET /public/trust/{code}        |
    |                                      |  tier=extended                   |
    |                                      |  &disclosure_token=...           |
    |  9. Sees full name, phone,           |                                  |
    |     eSignet-verified timestamp       |                                  |
    |<-------------------------------------|                                  |
    |                                      |                                  |
    | 10. Boards ride — consent_audit_entry is the trip record                |
    |                                      |                                  |
    | [optional] Taps “Panic share”        |                                  |
    |------------------------------------->|  POST /public/emergency/share    |
    |                                      |  → sim SMS to recipients         |
    |  Ref ID returned                     |  → logged as 'panic' in SMS      |
    |<-------------------------------------|    outbox (visible in admin)     |
```

---

### Channel B — USSD / feature phone

```
PASSENGER (feature phone)          USSD SIMULATOR                  SAFERIDE BACKEND
    |                                     |                                |
    | 1. Dials *XXX# (or uses            |                                |
    |    /simulate/ussd UI)              |                                |
    |----------------------------------→ |                                |
    |                                     |  POST /public/simulate/ussd   |
    |  CON SafeRide                       |  msisdn, session_id, input    |
    |  1 Verify driver                    |                                |
    |  2 Panic share                      |                                |
    |  3 Request more detail             |                                |
    |  0 Exit                             |                                |
    |<----------------------------------- |                                |
    |                                     |                                |
    | 2. Presses 1 → “Enter short code:” |                                |
    | 3. Types SR-XXXX                    |                                |
    |----------------------------------→ |                                |
    |                                     |  get_trust_public(code,        |
    |                                     |  tier=”minimal”)               |
    |  END: Ali M.|ACTIVE|KAA 123X|CLEAR |                                |
    |<----------------------------------- |  + log_sim_sms(tag=”ussd”)    |
    |                                     |                                |
    | [OR option 2: Panic share]          |                                |
    | Types short code                    |                                |
    |----------------------------------→ |  create_emergency_share()      |
    |  END: Panic shared. Ref=abc12345   |  sim SMS → recipients         |
    |<----------------------------------- |  logged tag=”panic”           |
    |                                     |                                |
    | [OR option 3: Request more detail] |                                |
    | Types short code                    |                                |
    |----------------------------------→ |  create_consent_request(       |
    |  END: Request abc12345.            |  channel=”ussd”)               |
    |  Ask driver to approve.            |  log_sim_sms(tag=”consent”)   |
    |<----------------------------------- |  → driver approves in app     |
    |  (SMS arrives: “Consent requested”)|  → passenger polls REST API   |
```

---

### What gets logged (audit trail)

| Event | Where recorded | Admin view |
|-------|---------------|------------|
| Driver verified (USSD) | `sim_sms` row, tag=`ussd` | `/admin/incidents` + `/admin/audit` |
| Consent requested | `consent_requests` table + `sim_sms` tag=`consent` | `/admin/audit` |
| Consent approved/denied | `consent_audit_entries` table | `/admin/audit` |
| Panic shared | `emergency_shares` table + `sim_sms` tag=`panic` | `/admin/incidents` |
| Report submitted | `public_reports` table + `sim_sms` tag=`report` | `/portal/incidents` + `/admin/incidents` |

---

### Inji stack integration (current + next steps)

| Component | Role in SafeRide | Status |
|-----------|-----------------|--------|
| **eSignet** | Driver identity verification at onboarding — issues `esignet_verified_at` | ✅ Working |
| **Inji Certify** | Issues W3C Verifiable Credential for driver badge after approval | ✅ Running (issuance payload pending alignment) |
| **Inji Wallet** | Driver holds VC on device; presents QR for offline/NFC verification | ⏳ Next — deep link after issuance |
| **Inji Verify** | Passenger scans driver's Wallet QR — cryptographic VC verification | ⏳ Next — replace trust-band lookup |

---

## Roadmap & TODO backlog

### Priority 1 — Close the golden path (hackathon demo)

- [x] **eSignet login** — Authorization code + PKCE + `private_key_jwt` + JWKS ID token verification.
- [x] **Driver onboarding** — eSignet → upsert operator → officer approval → short code allocated.
- [x] **Vehicle binding** — Registry + operator ↔ vehicle bindings; driver sees plates + QR on profile.
- [x] **Public trust verification** — `GET /public/trust/{code}` with 3-tier disclosure (minimal/standard/extended).
- [x] **Consent unlock** — Passenger requests → driver approves → disclosure token → extended tier.
- [x] **Panic share** — One-tap unauthenticated emergency share → simulated SMS → logged to admin incidents.
- [x] **USSD simulator** — Full menu (verify / panic / consent) wired to live backend services.
- [x] **QR badge** — Encodes `/verify/result/{short_code}`; shown on driver profile.
- [x] **Inji Certify running** — Stack up (certify:8090, mimoto:8099, inji-web:3002) alongside eSignet.
- [ ] **Enable Inji Certify issuance** — Set `INJI_CERTIFY_ENABLE=true`; align credential subject fields with deployment schema; test `POST /credentials/issue/operator/{id}`.
- [ ] **Ride/trip log** — Add a lightweight `ride_events` table; write a record when consent is approved (driver_id, passenger_msisdn, short_code, timestamp, channel). Expose in admin audit.
- [ ] **Driver consent notification** — Ensure driver portal profile page surfaces pending consent requests in real time (poll `/auth/me/consent-requests`); add badge count to sidebar.

### Priority 2 — Inji Wallet + Verify integration

- [ ] **Inji Wallet delivery** — After VC issuance, generate a deep link / QR (`inji://credential/...`) so the driver can claim the credential into Inji Wallet.
- [ ] **Inji Verify on passenger side** — Replace the trust-band database lookup on `/verify/result/[id]` with an **Inji Verify**-style cryptographic proof check against the issued VC; show “Verified by MOSIP” badge.
- [ ] **Offline QR flow** — Driver shows Wallet VC QR; passenger scans with Inji Verify; no network required for the core verification step.

### Priority 3 — Governance & operations

- [x] **Officer/admin dashboards** — Portal + admin operator lists, detail, bind/unbind; RoleGate on layouts.
- [x] **Corporate body scoping** — Officers see only their body's operators; system_admin sees all.
- [ ] **Role elevation UI** — Secure admin page (or CLI command) to assign `officer` / `admin` without direct DB access.
- [ ] **Incident action wiring** — Portal incidents: “Mark Under Review”, “Suspend”, “Add Note” actions are UI stubs; wire to `PATCH /operators/{id}/status` + a notes endpoint.
- [ ] **SACCO / authority workflow** — Tailor approval chain when transport authority requirements are confirmed.

### Priority 4 — Channels & inclusion

- [x] **Short-code lookup** — No-auth REST + USSD + web verify page.
- [ ] **Real carrier USSD/SMS** — Replace simulated endpoints with Africa's Talking or equivalent; keep simulator for tests.
- [ ] **NFC tap-to-verify** — Driver taps NFC tag; passenger phone opens `/verify/result/{code}`.
- [ ] **Offline / low-bandwidth** — Wallet-held VC works offline; explore compressed QR for feature phone display.

### Priority 5 — Engineering hardening

- [ ] **Postgres + Alembic** — Replace SQLite `create_all`; schema migrations tracked.
- [ ] **Persistent audit table** — Dedicated `audit_log` table instead of synthesising from operators/SMS rows.
- [ ] **HTTPS, cookie hardening, secrets management** — Before any production deployment.
- [ ] **Inji Certify credential schema** — Define SafeRide-specific VC context; publish DID document.

---


## Optional: AI Studio / Gemini

If you still use Google GenAI from this repo, set **`GEMINI_API_KEY`** in the root env (see `.env.example`). This is separate from eSignet/Inji.

---

## License / product

Product positioning and any deployment-specific links belong here when you finalize them.
