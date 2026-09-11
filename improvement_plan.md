# StudyHub AI — Improvement Plan

## 1. Executive Summary

- Current architecture: Vite + React 19 + React Router 8 client app, Express SSR server, SQLite-backed StudyHub API router, plus a separate Python proxy/fallback data layer and an unused MySQL/Drizzle configuration path.
- Overall health assessment: the project has a large, feature-rich UI and multiple useful tests, but the repository currently mixes multiple persistence and API strategies, and the authentication/authorization model is not enforced server-side. This makes the codebase harder to reason about and elevates the risk of privilege escalation, inconsistent behavior, and future maintenance issues.
- Major risks:
  - Server-side auth bypass via default `userId` fallback and client-side session storage.
  - Two or more data-source paths (`studyhub-proxy`, `studyhub-data`, `studyhub-sqlite`, MySQL `db/client`) with no single authoritative boundary.
  - Missing schema validation and input sanitization across API routes.
  - Documentation drift between the README and the actual codebase.
- Major opportunities:
  - Centralize API/data access around one verified persistence model.
  - Introduce explicit auth/session middleware and role checks.
  - Add contract tests and validation layers for every route.
  - Clean up stale files, configuration, and documentation.

## 2. Codebase Inventory

This analysis excludes files ignored by `.gitignore` and generated directories such as `node_modules`, `dist`, `.vite`, `.airo`, `.memory`, and `.env*` artifacts.

Important directories and responsibilities:

- `src/pages/*`: Route-level page components for landing, auth, dashboard, courses, quizzes, forum, admin, etc.
- `src/routes.tsx`: Flat route map wrapped by `DashboardLayout` and lazy-loaded page components.
- `src/layouts/*`: Shared layout wrappers (`RootLayout`, `Website`, `DashboardLayout`) plus layout parts (`Header`, `Footer`).
- `src/lib/*`: Shared client utilities (`api.ts`, `analytics-consent.ts`, `format-overrides.ts`, `site-meta.ts`, `seo-routes.ts`).
- `src/server/entry.ts`: Express SSR server, request handling, HTML shell rendering, production startup, and fallback SSR logic.
- `src/server/api/studyhub-sqlite.ts`: SQLite-backed StudyHub API router covering courses, notes, assignments, quizzes, flashcards, videos, plan, analytics, forum, admin, and auth.
- `src/server/api/studyhub-proxy.ts`: Proxy to a Python FastAPI backend, with fallback to static demo data in `studyhub-data.ts`.
- `src/server/api/studyhub-data.ts`: In-memory fallback dataset used when the Python backend is unavailable.
- `src/server/api/health/GET.ts`: Simple health endpoint.
- `src/server/db/*`: Database clients and schema definitions (`sqlite-client.ts`, `sqlite-schema.ts`, `migrate-and-seed.ts`, plus unused MySQL files `client.ts`, `config.ts`, `schema.ts`).
- `src/entry-server.tsx`: SSR render entry that builds a static router, query client, and server markup.
- `export-plugins/*`: Custom content/media/format override plugins plus error boundary utilities.
- `vite.config.ts`: Vite plugin stack, SSR config, custom dev middleware, CORS, host handling, and build settings.
- `package.json`, `package-lock.json`, `.npmrc`, `vitest.config.ts`, `eslint.config.js`, `drizzle.config.ts`, `env.example`: dependency, build, config, and environment management.
- `README.md`: Project documentation; currently drifted from actual implementation.
- `public/*`: Static assets and public JavaScript helpers.
- `src/components/*`, `src/components/ui/*`: UI components and tests.

## 3. Findings

### F-001 — P0 — Security / Auth
- Problem: The server does not enforce real authentication or authorization for privileged routes. Several handlers in `src/server/api/studyhub-sqlite.ts` default to `userId` = `'u1'` when no user context exists, which means any caller can impersonate a known user and access protected data.
- Evidence:
  - `src/server/api/studyhub-sqlite.ts`: `const userId = (req as any).userId || 'u1';` in `/study-plan`, `/analytics`, and `/user/me` handlers.
  - `src/pages/login.tsx`: login response is stored in `sessionStorage` or `localStorage`, and the page redirects by role without a verified server-side session.
  - `src/lib/api.ts`: login/register responses include a `token` shape, but the client does not use it and the server does not issue or verify it.
- Impact: Privilege escalation; any caller can read or modify another user’s data, including admin and lecturer resources.
- Recommended solution: Implement a verified session/token mechanism (JWT or signed cookie/session), add server-side auth middleware, and remove the `'u1'` fallback from all privileged endpoints.

### F-002 — P1 — Architecture / Data Layer
- Problem: The codebase has multiple overlapping data-source and API paths without a single canonical source of truth. `studyhub-proxy.ts` points to a Python FastAPI backend, `studyhub-data.ts` is a fallback in-memory dataset, `studyhub-sqlite.ts` serves the SQLite-backed API directly, and `client.ts`/`config.ts` define a separate MySQL/Drizzle path that is not connected from the current runtime.
- Evidence:
  - `src/server/api/studyhub-proxy.ts`: proxy to `PYTHON_API_URL` with fallback to `next()`.
  - `src/server/api/studyhub-data.ts`: large in-memory dataset, described as a fallback for the Python backend.
  - `src/server/api/studyhub-sqlite.ts`: full router for the advertised StudyHub API.
  - `src/server/db/client.ts`: MySQL/Drizzle client configuration with `getDatabaseCredentials()`.
  - `src/server/db/schema.ts`: empty placeholder file.
- Impact: Conflicting models, duplicate routes, difficult maintenance, inconsistent data contracts, and test ambiguity.
- Recommended solution: Choose one runtime persistence strategy for the main app (SQLite currently appears to be the active implementation), remove or clearly separate deprecated paths, and document the intended production stack. `REQUIRES VERIFICATION`: whether the Python backend exists outside this repository or whether the fallback dataset is deliberately part of the shipped app.

### F-003 — P1 — Reliability / API Robustness
- Problem: The proxy layer does not enforce timeouts, does not validate upstream response shape, and silently falls through on any error. This creates latent request hangs and inconsistent downstream behavior.
- Evidence:
  - `src/server/api/studyhub-proxy.ts`: `const upstream = await fetch(targetUrl, init); const data = await upstream.json();` with no timeout, no status/body validation, and a broad `catch { next(); }` fallback.
- Impact: Slow or hung requests when the upstream is unavailable; ambiguous failure modes; potential invalid JSON or unexpected payload crashes in combined paths.
- Recommended solution: Add explicit timeout handling, validate upstream status and content type, centralize error translation, and make fallback behavior configurable and observable.

### F-004 — P1 — Validation / Input Safety
- Problem: API routes accept raw request bodies and query parameters without schema validation or normalization, and several handlers perform `JSON.parse` directly on data from the DB or request payloads.
- Evidence:
  - `src/server/api/studyhub-sqlite.ts`: raw `req.body`, `req.query`, and direct `JSON.parse` use in forum threads, quiz questions, and admin routes.
  - `src/server/api/studyhub-data.ts`: request/body handling without schema validation.
- Impact: Malformed inputs can produce runtime exceptions, inconsistent API responses, and an increased attack surface for malformed or malicious payloads.
- Recommended solution: Introduce typed validation using Zod or a similar schema layer at the API boundary, validate query/body values before database actions, and replace raw `JSON.parse` with safe parsing helpers.

### F-005 — P1 — Maintainability / Dead Code
- Problem: The repo contains partially implemented or stale architectural artifacts that are not wired into the current runtime, including an unused MySQL/Drizzle path and a placeholder schema file.
- Evidence:
  - `src/server/db/client.ts`: MySQL/Drizzle pool configured and exported.
  - `src/server/db/config.ts`: loads `NOMAD_TASK_DIR/config.json` for database credentials.
  - `src/server/db/schema.ts`: exports nothing (`export {};`).
  - `src/server/entry.ts`: currently mounts `studyhubSqlite` and does not use the MySQL client.
- Impact: Confusing runtime architecture; hidden maintenance burden; risk of developers working on the wrong storage path.
- Recommended solution: Remove unused database stacks or explicitly activate them with tests, migrations, and docs; otherwise delete the unused code paths and their configuration.

### F-006 — P2 — Testing / Coverage Gaps
- Problem: The repository has useful tests for SSR helpers and some UI utilities, but few or no coverage paths for auth flows, authorization checks, route contracts, and the behavior of the Python proxy fallback path.
- Evidence:
  - Existing tests: `src/server/entry.test.ts`, `src/components/__tests__`, `src/lib/__tests__`.
  - Missing obvious test cases for: `/auth/login`, `/auth/register`, privileged endpoints, 401/403 handling, proxy timeout/retry behavior, and SQLite route validation errors.
- Impact: High chance of regressions in behavior that matters most to the app’s data integrity and security.
- Recommended solution: Add a focused test matrix covering unit, integration, and route-level security tests, especially for auth and protected data access.

### F-007 — P2 — Documentation / Configuration Drift
- Problem: The README describes a generic V8 app template, but the current repository is StudyHub AI with a different architecture, dependencies, and scripts. This makes setup and maintenance harder for contributors.
- Evidence:
  - `README.md`: template-focused description and outdated project structure.
  - `package.json`: includes StudyHub-specific scripts and dependencies (`drizzle`, `better-sqlite3`, `express`, `react-router`, etc.).
- Impact: New contributors may follow the wrong setup steps and misinterpret the architecture.
- Recommended solution: Rewrite the README to accurately describe the current app, runtime locations, data layers, environment variables, and development workflow.

### F-008 — P2 — Build / Runtime Safety
- Problem: Vite configuration is highly customized and mixes multiple dev-only features (SSR dev plugins, worktree preview support, API proxy, content/media plugins). The config uses permissive defaults (`allowedHosts`/`corsOrigins` default to `*`) and relies on runtime behavior that may be difficult to reason about in deployment.
- Evidence:
  - `vite.config.ts`: `worktreePreviewPlugin`, `ssrDevPlugin`, `apiDevPlugin`, `ssrCjsCompatPlugin`, `allowedHosts`, `corsOrigins`, and dev warmup logic.
- Impact: Hidden configuration drift between local development, preview, and production, especially around host restrictions and SSR behavior.
- Recommended solution: Split dev-only and production-only behavior into clearer config boundaries, enforce explicit host/CORS configuration, and add validation for required environment variables.

## 4. Improvement Phases

### Phase 1 — Harden Authentication and Authorization

Objective:
Introduce a verified, server-enforced auth model for all privileged routes and remove the implicit `userId || 'u1'` behavior that currently allows impersonation.

Priority:
P0

Files to MODIFY:
- `src/server/api/studyhub-sqlite.ts` — add auth middleware, require verified user context for `/study-plan`, `/analytics`, `/user/me`, `/admin/*`, and `/auth/*` route groups; remove hardcoded fallback user selection.
- `src/pages/login.tsx` — stop storing unverified client-side auth state as the sole source of truth; consume a server-issued token/session after verification.
- `src/pages/register.tsx` — align registration flow with the verified auth/session model.
- `src/lib/api.ts` — update client-side auth calls to use a verified token/session contract instead of placeholder `token` response assumptions.
- `src/server/entry.ts` — ensure all API routes use centralized auth middleware, consistent error responses, and no implicit trust of client-provided user data.
- `src/server/api/studyhub-proxy.ts` — prevent accidental bypass of auth when proxying upstream routes; only allow vetted routes and apply consistent auth enforcement.

Files to CREATE:
- `src/server/auth/session.ts` — session/token verification helpers and request-context enrichment.
- `src/server/auth/roles.ts` — role/permission helpers for student, lecturer, and admin checks.
- `src/server/__tests__/auth-flow.test.ts` — tests for login, unauthorized access, and role-gated routes.

Files to DELETE/DEPRECATE:
- None required in this phase.

Dependencies:
- None.

Implementation Prompt:
"Inspect the current auth and data-access flow in `src/server/api/studyhub-sqlite.ts`, `src/pages/login.tsx`, `src/pages/register.tsx`, `src/lib/api.ts`, and `src/server/entry.ts` before making any changes. Implement a server-enforced auth/session layer that verifies users for privileged routes, removes the implicit `'u1'` fallback behavior, and ensures `/study-plan`, `/analytics`, `/user/me`, and `/admin/*` only operate with a verified authenticated user and correct role. Update the client-side login/register flow to consume the verified server session/token contract, preserve existing UI behavior where possible, and add tests covering unauthorized access, role restrictions, and successful authenticated access. Do not refactor unrelated files. Validate with the relevant existing test commands and add any missing focused tests required for auth coverage."

Acceptance Criteria:
- All privileged API handlers require an authenticated user context and reject unauthenticated or unauthorized requests with explicit 401/403 responses.
- No route uses a hardcoded fallback user such as `'u1'` when request auth data is missing.
- Login/register flows use the verified session/token contract consistently.
- New auth tests pass and existing route tests remain green.

Validation:
- `npm run test -- --run src/server/__tests__/auth-flow.test.ts`
- `npm run type-check`
- `npm run lint -- src/server/api/studyhub-sqlite.ts src/server/entry.ts src/lib/api.ts src/pages/login.tsx src/pages/register.tsx`

### Phase 2 — Consolidate API and Data Architecture

Objective:
Choose one authoritative data/API path for the shipped app, remove duplicate and stale paths where appropriate, and make the effective runtime architecture explicit and testable.

Priority:
P1

Files to MODIFY:
- `src/server/entry.ts` — remove or clearly gate legacy data-source behavior after the canonical path is confirmed.
- `src/server/api/studyhub-sqlite.ts` — keep as the primary production router if SQLite is the target runtime path.
- `src/server/api/studyhub-proxy.ts` — reduce to a clearly documented optional proxy path, or remove it entirely if Python is not part of the repo’s runtime.
- `src/server/db/client.ts` — either retire or fully integrate with the selected runtime strategy.
- `src/server/db/config.ts` — align credentials loader with the chosen data stack.
- `src/server/db/schema.ts` — replace placeholder with actual schema exports if MySQL remains an option.
- `src/server/db/sqlite-client.ts` and `src/server/db/sqlite-schema.ts` — align with the canonical SQLite approach.
- `src/lib/api.ts` — update API surface if the main route contract changes.

Files to CREATE:
- `src/server/data/route-boundaries.ts` — explicit runtime boundary declarations for the canonical app data layer.
- `src/server/__tests__/api-boundary.test.ts` — tests that confirm the selected runtime path is the only active API source and that stale paths are properly disabled or documented.

Files to DELETE/DEPRECATE:
- `src/server/api/studyhub-data.ts` — deprecate once the canonical runtime path is verified and production behavior no longer depends on demo fallback data.

Dependencies:
- Phase 1.

Implementation Prompt:
"Inspect the actual runtime wiring in `src/server/entry.ts`, `src/server/api/studyhub-sqlite.ts`, `src/server/api/studyhub-proxy.ts`, `src/server/api/studyhub-data.ts`, `src/server/db/client.ts`, `src/server/db/config.ts`, and `src/server/db/sqlite-client.ts` before changing anything. Determine which storage/API path is the intended production path for this repository, then consolidate the code so there is a single authoritative data boundary and explicit runtime behavior for the app. Keep the existing UI contract intact where possible, but remove or clearly disable duplicate and stale data-source paths, document any intentional fallback behavior, and add tests that verify the chosen boundary is the only active one. Do not change unrelated route behavior or create broad refactors outside the API/data layer."

Acceptance Criteria:
- One canonical data/API path is clearly defined and used by the runtime.
- Duplicate or stale runtime paths are disabled, deprecated, or documented as intentionally unused.
- Existing route behavior remains consistent for supported UI scenarios.
- Tests verify the canonical boundary and any deprecated fallback behavior.

Validation:
- `npm run test -- --run src/server/__tests__/api-boundary.test.ts`
- `npm run type-check`
- `npm run lint -- src/server/entry.ts src/server/api/studyhub-sqlite.ts src/server/api/studyhub-proxy.ts src/server/db/client.ts src/server/db/config.ts src/server/db/sqlite-client.ts`

### Phase 3 — Add Validation, Contract Safety, and Error Handling

Objective:
Strengthen every API route with consistent input validation, safer parsing, explicit error translation, and route-level test coverage.

Priority:
P1

Files to MODIFY:
- `src/server/api/studyhub-sqlite.ts` — apply schema validation for query params, body payloads, and complex JSON fields; standardize error responses.
- `src/server/api/studyhub-proxy.ts` — add timeout, upstream response validation, and consistent logging and fallback policies.
- `src/server/entry.ts` — centralize error translation for API and SSR failures and ensure user-impacting failures are observable.
- `src/lib/api.ts` — align client-side API handling with validated server responses and consistent error surfaces.
- `src/server/entry.test.ts` — add tests for new validation, error handling, and fallback behaviors.
- `src/lib/__tests__/*` — extend coverage where needed for client-side contract assumptions.

Files to CREATE:
- `src/server/validation/schemas.ts` — Zod or equivalent schema definitions for auth, forum, admin, and course-related routes.
- `src/server/validation/parse.ts` — safe JSON parsing helpers with explicit error handling.
- `src/server/__tests__/api-contract.test.ts` — route-level contract and validation tests.

Files to DELETE/DEPRECATE:
- None required in this phase.

Dependencies:
- Phase 2.

Implementation Prompt:
"Inspect the current route implementations in `src/server/api/studyhub-sqlite.ts`, `src/server/api/studyhub-proxy.ts`, `src/server/entry.ts`, and `src/lib/api.ts` before editing. Add schema-based validation and safe parsing for every supported request/response contract, standardize HTTP error handling, and ensure malformed JSON or invalid body/query data is rejected predictably with explicit status code and error message. Keep the existing user-facing behavior intact for valid requests, add tests for invalid payloads and error paths, and avoid unrelated refactoring. Use existing project conventions and verify the route contract and error behavior with targeted tests."

Acceptance Criteria:
- Invalid query/body payloads return explicit, consistent 400/422 responses.
- `JSON.parse` calls are replaced or guarded by safe helpers for all route JSON fields.
- Proxy upstream errors are translated into consistent server responses and logs.
- Route contract tests cover valid and invalid input paths.

Validation:
- `npm run test -- --run src/server/__tests__/api-contract.test.ts`
- `npm run test -- --run src/server/entry.test.ts`
- `npm run type-check`
- `npm run lint -- src/server/api/studyhub-sqlite.ts src/server/api/studyhub-proxy.ts src/server/entry.ts src/lib/api.ts`

### Phase 4 — Documentation, CI, and Regression Hardening

Objective:
Align the repository documentation with the actual implementation, add missing automated coverage and quality gates, and make the project easier to maintain and deploy safely.

Priority:
P2

Files to MODIFY:
- `README.md` — replace template content with StudyHub AI architecture, setup, data flow, and current env expectations.
- `package.json` — add or refine scripts for auth-coverage, integration coverage, and any necessary validation commands.
- `vitest.config.ts` — ensure coverage and test discovery reflect the intended suite.
- `eslint.config.js` — tighten lint rules if needed for the new validation and data-layer code.
- `vite.config.ts` — document and verify production vs development behavior after earlier phases.
- `src/server/entry.test.ts` and relevant existing test files — expand regression coverage where needed.

Files to CREATE:
- `.github/workflows/ci.yml` — CI pipeline to run type-check, lint, and relevant tests on every change.
- `docs/architecture.md` — concise architecture overview of routes, data boundaries, and environment expectations.
- `docs/testing-strategy.md` — test matrix for unit, integration, security, and regression coverage.

Files to DELETE/DEPRECATE:
- None required in this phase.

Dependencies:
- Phases 1–3.

Implementation Prompt:
"Inspect `README.md`, `package.json`, `vitest.config.ts`, `eslint.config.js`, and the existing tests before editing. Update the project documentation so it reflects the real StudyHub AI architecture, current scripts, and environment variables, then add a CI workflow and test documentation that match the verified project requirements. Preserve existing functionality while adding the missing quality gates needed for regression prevention, and do not introduce unrelated refactoring."

Acceptance Criteria:
- `README.md` accurately describes the current app and setup process.
- CI workflow runs the current type-check, lint, and test commands needed for the project.
- Test and architecture docs exist and match the implemented repository structure.
- Existing commands continue to work without requiring hidden setup steps.

Validation:
- `npm run type-check`
- `npm run lint`
- `npm run test`
- Inspect generated CI configuration and documentation files for consistency with the repo state.

## 5. Phase Dependency Order

Phase 1 → Phase 2 → Phase 3 → Phase 4

(Phase 1 is the blocker because the current auth model is unsafe. Phase 2 depends on the chosen runtime boundary. Phase 3 depends on the route contracts stabilized in Phase 2. Phase 4 depends on all code changes being complete and validated.)

## 6. File Impact Matrix

| File | Action | Phase | Reason |
|------|--------|-------|--------|
| `src/server/api/studyhub-sqlite.ts` | MODIFY | 1 | Remove insecure auth fallback, add middleware, validate routes |
| `src/pages/login.tsx` | MODIFY | 1 | Align client auth flow with verified server session/token contract |
| `src/pages/register.tsx` | MODIFY | 1 | Align registration flow with verified server session/token contract |
| `src/lib/api.ts` | MODIFY | 1 | Update client contract for authenticated requests |
| `src/server/entry.ts` | MODIFY | 1 | Enforce auth centrally and improve API error handling |
| `src/server/api/studyhub-proxy.ts` | MODIFY | 1 | Ensure proxy path does not bypass auth or mask upstream failures |
| `src/server/auth/session.ts` | CREATE | 1 | Centralize auth/session verification |
| `src/server/auth/roles.ts` | CREATE | 1 | Centralize role-permission logic |
| `src/server/__tests__/auth-flow.test.ts` | CREATE | 1 | Cover auth and authorization gaps |
| `src/server/api/studyhub-proxy.ts` | MODIFY | 2 | Simplify or retire duplicate proxy behavior after choosing canonical path |
| `src/server/api/studyhub-data.ts` | DELETE / DEPRECATE | 2 | Remove stale fallback dependency once runtime boundary is verified |
| `src/server/db/client.ts` | MODIFY / REVIEW | 2 | Decide whether MySQL path is active or remove it |
| `src/server/db/config.ts` | MODIFY / REVIEW | 2 | Align env/config with chosen data layer |
| `src/server/db/schema.ts` | MODIFY / REVIEW | 2 | Replace placeholder with active schema exports if needed |
| `src/server/validation/schemas.ts` | CREATE | 3 | Add schema-driven request validation |
| `src/server/validation/parse.ts` | CREATE | 3 | Centralize safe JSON parsing |
| `src/server/__tests__/api-contract.test.ts` | CREATE | 3 | Add validation and contract tests |
| `README.md` | MODIFY | 4 | Correct docs to match actual architecture |
| `package.json` | MODIFY | 4 | Add or refine validation and CI-related commands |
| `vitest.config.ts` | MODIFY | 4 | Align test discovery with full suite |
| `eslint.config.js` | MODIFY | 4 | Enforce quality gates for new validation code |
| `.github/workflows/ci.yml` | CREATE | 4 | Add CI pipeline |
| `docs/architecture.md` | CREATE | 4 | Explain current system architecture |
| `docs/testing-strategy.md` | CREATE | 4 | Document test matrix and regression process |

## 7. Testing Strategy

- Unit tests:
  - Auth/session helpers (`src/server/auth/session.ts`, `src/server/auth/roles.ts`)
  - Validation/parsing helpers (`src/server/validation/parse.ts`)
  - Client-side auth request helpers (`src/lib/api.ts`)
- Integration tests:
  - Protected route access for student/lecturer/admin roles
  - SQLite route contract behavior for courses, forum, analytics, and admin endpoints
  - Proxy fallback behavior and error translation
- E2E tests:
  - Login/register flow through the UI
  - Dashboard and role-specific page navigation after auth
  - Admin-only workflows
- Security tests:
  - Unauthenticated access rejects with 401/403
  - Cross-role access is blocked
  - Malformed and oversized payloads are rejected
- Performance checks:
  - Route latency for `/courses`, `/forum`, `/analytics`, and `/admin/users`
  - Query-level hotspot review for repeated database opens/closes where applicable
- Regression checks:
  - Existing SSR and UI test suites remain green after auth and route changes
  - `npm run build` succeeds for both client and SSR outputs

## 8. Deployment/Rollout Considerations

- Authentication model: If switching to signed cookies or JWTs, coordinate token/session configuration with hosting and reverse-proxy settings.
- Environment variables: verify `DB_PATH`, `PYTHON_API_URL`, `PORT`, `HOST`, `VITE_PARENT_ORIGIN`, `ALLOWED_ORIGINS`, and any new auth/session secrets before rollout.
- Database migration: if the canonical path shifts or the MySQL path is reactivated, verify migration steps and schema parity before touching production data.
- Fallback behavior: if the proxy/fallback path is kept, make the fallback policy visible and measurable so operators know when the app is running in degraded mode.
- Observability: add structured logs for auth failures, upstream proxy errors, malformed input, and SSR render failures so operational issues are discoverable.
- Rollout strategy: deploy Phase 1 auth changes carefully behind a feature flag or controlled release, then move to Phase 2-4 once the stronger auth boundary is stable.

## 9. Final Prioritized Roadmap

### 1. Critical fixes
- F-001: Auth/authorization enforcement and removal of fallback impersonation
- F-002: Canonical data/API boundary definition
- F-003: Proxy reliability and upstream failure handling

### 2. High-value improvements
- F-004: Schema validation and safe parsing for all routes
- F-005: Remove or activate dead architectural artifacts (`MySQL/Drizzle`, stale schema files)
- F-006: Add missing auth, integration, and security test coverage

### 3. Medium improvements
- F-007: Rewrite README and align docs with the real codebase
- F-008: Harden Vite/runtime config boundaries and env validation

### 4. Optional / polish improvements
- Additional UX/accessibility refinements across pages and shared components once stability work is complete
- Dedicated performance profiling and bundle-size review after the architecture is stabilized

## Closing Note

This plan was derived from direct inspection of the repository’s tracked files, excluding `.gitignore`-ignored paths and generated artifacts. The most urgent work is Phase 1, because the current server-side auth model does not enforce user identity or role boundaries for the StudyHub data layer.
