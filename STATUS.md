# SafeRide — UI pages & API wiring

Snapshot of **designed Next.js routes** and whether they call the **FastAPI** backend today.

**Legend**

| Tag | Meaning |
|-----|---------|
| **Hooked** | Uses `lib/api` / session hook / full-page redirect to a live backend route. |
| **Partial** | Mix of backend data and local mock, or only one slice of the page is API-driven. |
| **Not hooked** | Static UI and/or `@/lib/mock-data` only; no production API calls. |

**Environment:** Frontend needs `NEXT_PUBLIC_API_URL` (e.g. `http://127.0.0.1:8000`) for any **Hooked** / **Partial** behavior.

---

## Pages (`app/` routes)

| Route | Area | Designed for | API wiring | Backend endpoints involved |
|-------|------|----------------|------------|----------------------------|
| `/` | Marketing | Landing, hero, CTAs | **Not hooked** | — |
| `/how-it-works` | Marketing | Product explanation | **Not hooked** | — |
| `/privacy` | Marketing | Trust & privacy copy | **Not hooked** | — |
| `/login` | Auth | Role picker, demo “continue”, eSignet + token | **Hooked** | Browser → `GET /auth/esignet/login` (with optional `?next=`). `useOperatorSession` → `GET /auth/me` after token stored. |
| `/verify` | Passenger | Start verification flow | **Not hooked** | — |
| `/verify/result/[id]` | Passenger | Result for code/ID | **Not hooked** (uses `mockOperators` by short code) | — |
| `/report` | Passenger | Incident reporting UI | **Not hooked** | — |
| `/offline` | PWA | Offline shell | **Not hooked** | — |
| `/driver/profile` | Driver | Profile, QR block, tabs | **Partial** | `GET /auth/me` when `saferide_access_token` exists (name, phone, status, alerts). Vehicle / history tabs still **mock**. |
| `/driver/vehicle` | Driver | Vehicle info | **Not hooked** | — |
| `/driver/status` | Driver | Status view | **Not hooked** | — |
| `/driver/consent` | Driver | Consent flow | **Not hooked** | — |
| `/portal` | Officer | Dashboard stats, lists | **Not hooked** | — |
| `/portal/operators` | Officer | Operator directory | **Not hooked** | — |
| `/portal/operators/new` | Officer | New operator form | **Not hooked** | — |
| `/portal/operators/[id]` | Officer | Operator detail | **Not hooked** (mock lookup by `id`) | — |
| `/portal/vehicles` | Officer | Vehicle table | **Not hooked** | — |
| `/portal/badges` | Officer | Badge issuance UI | **Not hooked** | — |
| `/portal/incidents` | Officer | Incidents list | **Not hooked** | — |
| `/admin` | Admin | Admin dashboard | **Not hooked** | — |
| `/admin/operators` | Admin | Operator admin table | **Not hooked** | — |
| `/admin/vehicles` | Admin | Vehicle admin table | **Not hooked** | — |
| `/admin/incidents` | Admin | Incidents admin | **Not hooked** | — |
| `/admin/audit` | Admin | Audit log view | **Not hooked** (inline mock array) | — |
| `/admin/settings` | Admin | Settings placeholders | **Not hooked** | — |

### Global wiring (not a “page”)

| Mechanism | Role | Endpoints |
|-----------|------|-----------|
| `OauthFragmentHandler` (in `app/layout.tsx`) | Reads `#access_token=…` after eSignet callback redirect | Indirect: token then `GET /auth/me` via hook |
| `hooks/use-operator-session.ts` | Bearer token + `/auth/me` | `GET /auth/me` |
| `lib/api/client.ts` | `fetchOperator`, `apiFetch` helpers | `GET /operators/{id}` available **but no page calls it yet** |

---

## Backend routes (implemented)

All served from `NEXT_PUBLIC_API_URL` (no `/api/v1` prefix on these).

| Method | Path | Purpose | Used by UI today? |
|--------|------|---------|-------------------|
| `GET` | `/auth/esignet/login` | Start OIDC; optional `?next=` | **Yes** — login link (full navigation) |
| `GET` | `/auth/esignet/callback` | Finish OIDC; redirect or `?response_mode=json` | **Yes** — IdP redirect target |
| `GET` | `/auth/me` | Current operator + `role` | **Yes** — login hook + driver profile |
| `GET` | `/operators/{operator_id}` | Operator by UUID | **No** — client helper exists, no page wired |
| `POST` | `/credentials/issue/operator/{operator_id}` | Inji operator VC | **No** |
| `POST` | `/credentials/issue/vehicle/{operator_id}/{vehicle_id}` | Inji binding VC | **No** |
| `GET` | `/credentials/{credential_id}` | Fetch stored credential row | **No** |

OpenAPI UI: `GET /docs` on the API host.

---

## Summary counts

- **Designed page routes:** 25 `page.tsx` files under `app/`.
- **Hooked to backend:** 1 route fully (`/login` flow + session).
- **Partial:** 1 (`/driver/profile`).
- **Not hooked:** remainder (static and/or `lib/mock-data`).
- **Backend endpoints with no UI consumer yet:** `GET /operators/{id}`, all `/credentials/*`.

---

## Suggested next hooks (product order)

1. **`/portal/operators`**, **`/admin/operators`** → list/create operators from API (needs new list/create endpoints or pagination).
2. **`/verify/result/[id]`** → verification API (not implemented on backend yet).
3. **Credentials / badges** → `POST /credentials/issue/…` + `GET /credentials/{id}` from officer flows.
4. **Replace mock incidents/vehicles** → requires new FastAPI resources.

---

*Last updated to match the repository layout and grep-based wiring audit. Regenerate when adding routes or `fetch` calls.*
