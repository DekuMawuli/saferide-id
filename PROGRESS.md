# SafeRide — Progress report (submission / judge-facing)

This document describes **what the repository actually delivers today** relative to the full SafeRide product vision (trusted operator enrollment, vehicle binding, passenger verification, multi-channel access, consent, governance, and emergency flows).

For **route-by-route API wiring**, see [`STATUS.md`](./STATUS.md). For **how to run the stack**, see [`README.md`](./README.md). For **review feedback triage and technical guidance**, see [`TECHNICAL_NOTES.md`](./TECHNICAL_NOTES.md).

---

## Executive summary

SafeRide is a **solid Phase 1 prototype foundation**: Next.js + FastAPI, eSignet-based operator authentication, role-aware application shells, and backend scaffolding for operator/vehicle models and Inji Certify–style credential issuance. It demonstrates the **core architecture** and a plausible **golden path** for operators.

It does **not yet** fully satisfy the complete SafeRide concept as typically described in product submissions: real end-to-end VC issuance aligned to a live Inji deployment, passenger-facing verification backed by trust facts, multi-channel verification (QR/NFC/SMS/USSD/voice/short-code), consent-based disclosure, panic/emergency share, and SACCO/authority-led trust-status operations are still **incomplete or absent**.

**One-line description for judges:**

> SafeRide currently has a working web/backend prototype with eSignet-based operator authentication, role-aware shells, and backend scaffolding for operator/vehicle credentials via Inji Certify. It shows architecture and a prototype golden path; passenger trust verification, multi-channel access, consent-based disclosure, panic sharing, and production-grade credential issuance/verification still need to be completed.

---

## Implemented (achieved)

- **Stack:** Next.js frontend, FastAPI backend, SQLite/SQLModel by default.
- **Operator authentication:** eSignet OIDC (`GET /auth/esignet/login`, `GET /auth/esignet/callback`), SafeRide JWT after callback, operator persistence, `GET /auth/me`.
- **Session on web:** OAuth fragment handler, token storage, session hook calling `/auth/me`.
- **RBAC (application level):** operator `role` (`passenger` | `driver` | `officer` | `admin`), post-login redirect with allowlisted `?next=` validated against role.
- **Data model direction:** Operator, vehicle, operator–vehicle binding, credential records; credential issue and fetch **API routes** exist.
- **UX shells:** Marketing, driver, portal (officer), admin, verify/report **screens** (most passenger/portal/admin flows still mock-backed on the frontend).
- **Inji Certify:** Service and HTTP integration **scaffolding** (disabled by default; payload paths need alignment with real deployment).

---

## Partially implemented

| Area | What exists | What is missing |
|------|-------------|-----------------|
| **Operator onboarding** | Auth + DB row after IdP | Formal approval workflow (`PENDING` → `ACTIVE`), SACCO/authority steps |
| **Vehicle binding** | Models + credential issue endpoints | End-to-end UI, real issuance payloads, verifier consumption |
| **Verify / report** | Pages and flows as **demos** | Backend verification APIs, minimal trust facts, real compliance state |
| **Inji issuance** | Routes + service structure | Production field mapping, enabled-by-default operation, wallet delivery |
| **Admin / officer tools** | Layouts and tables (mock) | Approve/suspend/expire, vehicle/binding management without raw DB edits |
| **Driver profile** | `/auth/me` for header/session slice | Vehicle/history tabs and QR/badge still largely mock |

---

## Not yet implemented (major product gaps)

1. **Production Inji Certify path** — Real VC issuance, correct templates/paths, and operator-held credentials in a wallet are not finished in this repo.
2. **Passenger verification product** — Minimal trust facts (name, photo preview, vehicle, status) backed by APIs and VC/verify logic, not only mock lookup.
3. **Multi-channel verification** — Short-code, SMS, USSD, voice, NFC, offline verification, and “no phone” pathways are not implemented as working channels.
4. **Consent-based disclosure** — Policy layer, unlock/consent requests, minimal vs sensitive projections, wallet-style approval.
5. **Emergency / panic share** — One-tap share of driver + vehicle trust reference to contacts or authorities as a completed pipeline.
6. **Trust governance** — Operational tools for SACCOs/authorities to drive **Active / Suspended / Expired** (and related states) through the product UI and APIs.
7. **Wallet / signed badge / lightweight verifier** — Signed QR/NFC badge generation, Inji Verify–class verifier UX, and offline trust checks.

---

## Maturity vs a simple roadmap

| Stage | Status |
|-------|--------|
| Prototype shell + backend structure | **Achieved** |
| Operator auth via eSignet + session | **Achieved** |
| Role-aware routing / shells | **Achieved** |
| Credential API skeleton | **Achieved** |
| Real signed badge + QR verification | **Not achieved** |
| Short-code / alternate channels | **Not achieved** |
| Consent unlock flow | **Not achieved** |
| Wallet integration | **Not achieved** |
| Panic / emergency share | **Not achieved** |
| SACCO-led suspension workflow (productized) | **Not achieved** |
| Offline verification | **Not achieved** |

---

## Recommended next milestones (highest value)

1. **Complete one real golden path** — eSignet login → approval/binding steps as needed → real Inji issuance (aligned to your environment) → **verifier screen** showing name, photo, vehicle plate, and trust status.
2. **Trust-status operations** — Approve / suspend / expire driver (and related entities) via officer/admin surfaces backed by API rules.
3. **Minimal trust facts** — Passenger-facing API and UI that expose only the agreed minimal set until consent unlock.
4. **One low-resource channel** — Short-code or SMS first, before full USSD/voice.
5. **Emergency share** — Simple, explicit flow to share driver + vehicle reference to a trusted contact or channel.

---

## Honest positioning

- **Matches well:** Foundation, prototype phase intent, architecture direction, operator auth story, credential-shaped backend.
- **Does not yet match:** Full submission scope for inclusion (channels), privacy (consent), verification (real trust facts), governance (operational workflows), and emergency behaviors.

This report should be updated whenever major features (especially verification APIs, Inji alignment, or governance APIs) ship.

**Actionable checklist:** see [README.md](./README.md) → **Roadmap & tasks (TODO)** (merged engineering + product backlog).

**Update (Milestones 3–5):** Disclosure tiers + consent polling + audit, public panic/report, and **unauthenticated** USSD/SMS **simulators** (`/public/simulate/*`, UI `/simulate/ussd` & `/simulate/sms`) are implemented as lab tooling — not production carrier integrations.
