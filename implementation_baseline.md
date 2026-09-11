# Implementation Baseline

## 1. Verified Runtime Architecture

### 1.1 Project entrypoints and startup

CONFIRMED:
- `package.json` defines the runtime scripts and package manager metadata.
- `npm run dev` runs `vite`.
- `npm run build` runs `vite build && vite build --ssr src/server/entry.ts`.
- `npm run test` runs `vitest`.
- `npm run type-check` runs `tsc --noEmit`.
- `npm run lint` runs `eslint .`.
- `npm run preview` runs `vite preview`.

CONFIRMED:
- `vite.config.ts` configures a Vite dev server with:
  - `apiDevPlugin()` registered at `apply: "serve"`
  - `ssrDevPlugin()` registered at `apply: "serve"`
  - `worktreePreviewPlugin()` registered at `apply: "serve"`
  - `contentPlugin()` and `formatOverridesPlugin()` in the plugin chain
- `vite.config.ts` also defines `server` and `preview` host/CORS/allowedHosts behavior.
- `vite.config.ts` sets `envPrefix: ["VITE_", "SITE_"]`, so client-side env vars are scoped to `VITE_` and `SITE_`.

CONFIRMED:
- `src/server/entry.ts` is the Express server entrypoint.
- `src/server/entry.ts` imports and mounts:
  - `healthGet` at `/api/health`
  - `studyhubSqlite` at `/api`
- `src/server/entry.ts` then registers a JSON error middleware for `/api` that always responds with `{ error: "Internal server error" }`.
- The production branch of `src/server/entry.ts` serves static client assets and handles SSR fallback rendering for non-API routes.

CONFIRMED:
- `src/entry-server.tsx` is the SSR render entrypoint.
- It builds a static handler from `src/routes.tsx` and renders the route tree by calling `renderToString()`.

CONFIRMED:
- `src/main.tsx` is the client bootstrap entrypoint.
- `src/App.tsx` wraps the browser router and mounts the `CookieBanner` component.
- `src/routes.tsx` defines the route tree; it includes public routes (`/`, `/get-started`, `/login`, `/register`) and role-based dashboard layouts (`student`, `lecturer`, `admin`).

### 1.2 What is actually wired at runtime

CONFIRMED:
- The runtime Express app currently mounts only `studyhubSqlite` under `/api`.
- `src/server/api/studyhub-proxy.ts` is not imported in `src/server/entry.ts`.
- `src/server/api/studyhub-data.ts` is not imported in `src/server/entry.ts`.
- Therefore, the actual runtime API surface for live requests is the SQLite-backed router in `src/server/api/studyhub-sqlite.ts`, not the Python proxy or the in-memory fallback router.

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts` is the live request handler for `/api/*` routes in the current server entry.

INFERRED:
- `src/server/api/studyhub-proxy.ts` appears intended to be a Python FastAPI proxy, but the repository does not currently wire it into the runtime server entry.
- `src/server/api/studyhub-data.ts` appears intended as a fallback data layer, but the current server entry does not mount it either.

REQUIRES VERIFICATION:
- Whether the Python FastAPI service exists in the deployment environment and serves the intended upstream routes.
- Whether the in-memory fallback data is purposely kept as a code artifact rather than an unused stub.

## 2. Complete API Route Inventory

Route inventory is based on direct inspection of `src/server/api/studyhub-sqlite.ts` and `src/server/api/studyhub-data.ts`.

### 2.1 Route entries discovered

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts` defines 23 route entries.
- `src/server/api/studyhub-data.ts` defines 23 route entries.
- `src/server/entry.ts` defines 1 additional route entry at `/api/health`.
- Total discovered route entries across server route files: 47.
- Unique route paths across the two route modules: 23 distinct paths (excluding health), with `studyhub-data.ts` mirroring the same paths as `studyhub-sqlite.ts`.

### 2.2 Runtime route inventory (`src/server/api/studyhub-sqlite.ts`)

CONFIRMED:
- `GET /courses`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/courses', ...)`
  - Auth requirement: none enforced in code
  - Authz/role requirement: none enforced in code
  - Data source: SQLite via `better-sqlite3` and `DB_PATH`
  - Inputs: none
  - Response: JSON array of course rows
  - Error behavior: returns 404 for missing course detail endpoints; otherwise no explicit validation

- `GET /courses/:id`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/courses/:id', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`
  - Response: single course JSON or 404 `{ error: 'Not found' }`
  - Error behavior: 404 on missing record

- `GET /notes`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/notes', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `course` query param
  - Response: JSON array of notes
  - Error behavior: none beyond DB exceptions; no validation

- `GET /assignments`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/assignments', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `course` query param
  - Response: JSON array of assignments
  - Error behavior: none beyond DB exceptions

- `GET /quizzes`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/quizzes', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `course` query param
  - Response: JSON array of quiz summaries plus nested `questions` arrays; `options` are parsed with `JSON.parse(qq.options)`
  - Error behavior: no explicit validation; malformed JSON in stored `options` would throw

- `GET /quizzes/:id`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/quizzes/:id', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`
  - Response: single quiz JSON or 404
  - Error behavior: 404 on missing quiz; raw `JSON.parse` on stored `options`

- `GET /flashcards`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/flashcards', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `deck` query param
  - Response: JSON array of flashcards
  - Error behavior: none beyond DB exceptions

- `GET /videos`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/videos', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `course` query param
  - Response: JSON array of videos
  - Error behavior: none beyond DB exceptions

- `GET /study-plan`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/study-plan', ...)`
  - Auth requirement: not enforced; code attempts `const userId = (req as any).userId || 'u1'`
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: none from client; user context is looked up from `req.userId` or hardcoded `u1`
  - Response: JSON array of study tasks
  - Error behavior: no 401/403 path; defaults to demo user if auth missing

- `POST /study-plan`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.post('/study-plan', ...)`
  - Auth requirement: not enforced; code uses `req.userId || 'u1'`
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: body with `title`, `course`, `dueDate`, `time`, `duration`, `type`
  - Response: 201 JSON task plus inserted row
  - Error behavior: 400 `{ error: 'Missing fields' }` if title/course/dueDate missing

- `PATCH /study-plan/:id/toggle`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.patch('/study-plan/:id/toggle', ...)`
  - Auth requirement: not enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`
  - Response: updated task JSON
  - Error behavior: 404 `{ error: 'Not found' }` when row missing

- `GET /analytics`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/analytics', ...)`
  - Auth requirement: not enforced; code uses `req.userId || 'u1'`
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: none from client; uses `req.userId` or default `u1`
  - Response: analytics payload containing serialized JSON fields (`weeklyProgress`, `recentQuizScores`, `subjectStrengths`, `radarData`)
  - Error behavior: 404 `{ error: 'No analytics found' }` if no snapshot exists for the resolved user

- `GET /forum`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/forum', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `course` query param
  - Response: thread list with nested `replyList` data and derived `replies` count
  - Error behavior: no explicit validation; `JSON.parse(t.tags)` is used directly

- `GET /forum/:id`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/forum/:id', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`
  - Response: single thread JSON with reply list
  - Error behavior: 404 `{ error: 'Not found' }`

- `POST /forum`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.post('/forum', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: body with `title`, `course`, `author`, `authorRole`, `content`, `tags`
  - Response: 201 thread JSON
  - Error behavior: 400 `{ error: 'Missing fields' }` if title or course missing

- `POST /forum/:id/replies`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.post('/forum/:id/replies', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`; body with `author`, `authorRole`, `content`
  - Response: 201 reply JSON
  - Error behavior: 400 `{ error: 'Missing content' }` if content missing

- `GET /admin/stats`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/admin/stats', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: none
  - Response: aggregate admin stats JSON
  - Error behavior: none beyond DB exceptions

- `GET /admin/users`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/admin/users', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: optional `search` query param
  - Response: user rows or filtered results
  - Error behavior: none beyond DB exceptions

- `PATCH /admin/users/:id/status`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.patch('/admin/users/:id/status', ...)`
  - Auth requirement: none enforced
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: path parameter `id`; body with `status`
  - Response: updated user row
  - Error behavior: 400 `{ error: 'Invalid status' }` if non-allowed status is supplied; 404 `{ error: 'Not found' }` if target user missing

- `POST /auth/register`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.post('/auth/register', ...)`
  - Auth requirement: register endpoint is public
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: body with `name`, `email`, `password`, optional `role`, `program`, `year`, `department`
  - Response: 201 JSON with `user` and `message`
  - Error behavior: 400 for missing fields/weak passwords, 409 for duplicate email

- `POST /auth/login`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.post('/auth/login', ...)`
  - Auth requirement: public endpoint for credential verification
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: body with `email`, `password`
  - Response: JSON with `user` and `message`
  - Error behavior: 400 missing fields, 401 invalid credentials, 403 suspended account

- `GET /user/me`
  - Source: `src/server/api/studyhub-sqlite.ts`
  - Handler: `router.get('/user/me', ...)`
  - Auth requirement: not enforced; code uses `req.userId || 'u1'`
  - Role requirement: none enforced
  - Data source: SQLite
  - Inputs: none from client; resolves user from `req.userId` or default `u1`
  - Response: JSON user profile record
  - Error behavior: 404 `{ error: 'Not found' }`

### 2.3 Additional server route file (`src/server/entry.ts`)

CONFIRMED:
- `GET /api/health`
  - Source: `src/server/api/health/GET.ts`
  - Handler: `healthGet`
  - Auth requirement: none
  - Role requirement: none
  - Data source: none (hardcoded response)
  - Inputs: none
  - Response: `{ status: "ok", timestamp, message: "Hello World!" }`
  - Error behavior: none explicit; returns JSON by default

### 2.4 Fallback router mirror (`src/server/api/studyhub-data.ts`)

CONFIRMED:
- `src/server/api/studyhub-data.ts` defines the same path structure as the SQLite router, but it serves in-memory arrays and objects instead of SQLite rows.
- It includes the additional `/notifications` endpoints and `/notifications/:id/read`.
- It returns mock-token login/register responses and derives role from the incoming email (`admin`, `lecturer`, `student`).

INFERRED:
- This file is a functional mirror of the live router and appears to be a standalone fallback/demo layer.

REQUIRES VERIFICATION:
- Whether the in-memory fallback is intentionally shipped for demo mode, or currently just unused code.

## 3. Authentication Flow

### 3.1 UI login flow

CONFIRMED:
- `src/pages/login.tsx` sends a `POST /api/auth/login` request directly from the browser.
- On success, the UI stores `data.user` in `sessionStorage` or `localStorage` depending on the `remember me` checkbox.
- The UI then redirects the browser using the client-supplied `data.user.role`:
  - `admin` -> `/admin`
  - `lecturer` -> `/lecturer`
  - else -> `/dashboard`

CONFIRMED:
- `src/pages/register.tsx` sends `POST /api/auth/register` and redirects to `/login` after a successful registration response.

### 3.2 API login and register flow

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts` handles `POST /auth/login` and `POST /auth/register`.
- `POST /auth/register` validates input only for presence and minimum password length, then inserts a new row into `users` with a bcrypt hash.
- `POST /auth/login` verifies the email and password against `users.password_hash` and returns the user object.
- No token or session is created in the server code.
- No cookie, JWT, or server-side session store is created in the inspected runtime code.

CONFIRMED:
- `src/lib/api.ts` defines `login` and `register` client helpers that expect `{ token: string; user: User }` from the API, but the current server `POST /auth/login` and `POST /auth/register` responses do not include a token in the SQLite route.

INFERRED:
- The client uses `data.user.role` directly for redirect decisions, which means the browser is effectively trusted as the source of role/state.

REQUIRES VERIFICATION:
- Whether the intended authentication contract is a real token/session mechanism that exists outside the inspected repo.

### 3.3 Request authentication and user identity resolution

CONFIRMED:
- No request middleware for authentication is present in `src/server/entry.ts`.
- No middleware is mounted before the `/api` routes to populate `req.userId`, `req.user`, or any authenticated session data.
- Several handlers in `src/server/api/studyhub-sqlite.ts` resolve user identity as `const userId = (req as any).userId || 'u1';`.

CONFIRMED:
- The following routes currently trust a client-controlled fallback user instead of a verified auth context:
  - `GET /study-plan`
  - `POST /study-plan`
  - `GET /analytics`
  - `GET /user/me`

CONFIRMED:
- There is no inspected server-side check that rejects unauthenticated access to those protected user-scoped routes.

### 3.4 Client-controlled values that are trusted

CONFIRMED:
- `src/pages/login.tsx` trusts the server response `data.user.role` for page routing.
- `src/pages/login.tsx` stores `data.user` in browser storage and later relies on browser state rather than a server-issued session.
- `src/server/api/studyhub-sqlite.ts` trusts `req.userId` when present and falls back to `'u1'`.
- `src/server/api/studyhub-data.ts` derives `role` from the submitted email and returns a mock token for the client.

## 4. Authorization / Role Flow

CONFIRMED:
- Role values are stored in the `users` table (`role` column in `src/server/db/sqlite-schema.ts`).
- The supported role labels are documented in comments as `student | lecturer | admin`.

CONFIRMED:
- `src/routes.tsx` defines separate route trees for `student`, `lecturer`, and `admin` layouts, but the route tree itself contains no server-side authorization checks.

CONFIRMED:
- `src/pages/login.tsx` does client-side redirecting based on `role` without any server verification.

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts` does not enforce role checks on `/admin/*` or `/admin/users/:id/status`.
- `GET /admin/stats`, `GET /admin/users`, and `PATCH /admin/users/:id/status` are exposed without any inspected auth middleware.

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts` does not enforce role checks on `/user/me`, `/study-plan`, or `/analytics`.

INFERRED:
- The current role handling is UI-level and browser-level only, rather than a server-authoritative authorization model.

REQUIRES VERIFICATION:
- Whether there is an external auth provider or middleware outside this repository that applies real authorization in deployment.

## 5. Data Source Map

### 5.1 Classification of data paths

CONFIRMED:
- ACTIVE:
  - `src/server/api/studyhub-sqlite.ts` is the route mounted by `src/server/entry.ts` at `/api`.
  - SQLite data access is performed directly using `better-sqlite3` with `DB_PATH`.
- OPTIONAL / UNMOUNTED:
  - `src/server/api/studyhub-proxy.ts` is present and comments describe a Python FastAPI proxy, but it is not imported or mounted by `src/server/entry.ts`.
- FALLBACK / UNUSED:
  - `src/server/api/studyhub-data.ts` is not mounted by `src/server/entry.ts`, but it contains in-memory fallback/demo data that mirrors the SQLite route structure.
- UNUSED / STALE:
  - `src/server/db/client.ts` creates a MySQL pool through Drizzle, but the active server entry does not use it for request handling.
  - `src/server/db/config.ts` loads credentials from `$NOMAD_TASK_DIR/config.json` or `/local/config.json` for the MySQL path.
  - `src/server/db/schema.ts` is an empty placeholder (`export {};`).
  - `src/server/db/sqlite-client.ts` exists but is not used by the active request pipeline.
  - `src/server/db/sqlite-schema.ts` exists and is used by `migrate-and-seed.ts`, but the active runtime server does not import it directly.
- UNKNOWN:
  - Whether the Python FastAPI backend is part of production deployment or only exists in another repository/service.

### 5.2 Direct data access points

CONFIRMED:
- SQLite data access is performed directly by `src/server/api/studyhub-sqlite.ts` using `better-sqlite3` and `DB_PATH`.
- Seed and schema setup is handled by `src/server/db/migrate-and-seed.ts`.
- `src/server/db/sqlite-schema.ts` defines the SQLite tables (`users`, `courses`, `notes`, `assignments`, `quizzes`, etc.).

CONFIRMED:
- MySQL/Drizzle code exists in `src/server/db/client.ts`, but it is not the path currently mounted in `src/server/entry.ts`.

CONFIRMED:
- `src/server/api/studyhub-data.ts` contains in-memory arrays and mocks for all of the same route groups served by the SQLite router.

CONFIRMED:
- `src/lib/api.ts` is the client-side wrapper that calls `/api/*` routes, but it does not itself open a database or perform server-side data reads.

## 6. Dependency / Import Map

### 6.1 Direct dependencies by inspected file

CONFIRMED:
- `src/server/entry.ts`
  - Imports: `healthGet`, `studyhubSqlite`
  - Uses: `seoRoutes`, `adsense-manifest`, `indexnow-key`, `seo-host`, `llms-txt`
  - Runtime mount: `app.use("/api", studyhubSqlite)`

CONFIRMED:
- `src/server/api/studyhub-sqlite.ts`
  - Depends on `better-sqlite3`
  - Uses `bcryptjs` and `crypto.randomUUID()`
  - Reads `process.env.DB_PATH`
  - Uses direct SQL queries against SQLite tables

CONFIRMED:
- `src/server/api/studyhub-proxy.ts`
  - Depends on `fetch`
  - Reads `process.env.PYTHON_API_URL`
  - Calls `next()` on failure, which means it is not a self-sufficient production handler in the current entry wiring

CONFIRMED:
- `src/server/api/studyhub-data.ts`
  - Is a standalone Express router module with no imports of SQLite or the proxy
  - Contains mock data and route handlers mirroring the live API paths

CONFIRMED:
- `src/server/db/client.ts`
  - Imports `drizzle`, `mysql2/promise`, `getDatabaseCredentials`, and `schema`
  - Uses MySQL connection pool configuration

CONFIRMED:
- `src/server/db/config.ts`
  - Reads `$NOMAD_TASK_DIR/config.json` or `/local/config.json` via `fs`
  - Called by `drizzle.config.ts`
  - Not currently consumed by the live `studyhubSqlite` request flow

CONFIRMED:
- `drizzle.config.ts`
  - Imports `getDatabaseCredentials` from `./src/server/db/config`
  - Points `schema` to `./src/server/db/schema.ts`
  - Uses MySQL as the dialect in configuration

CONFIRMED:
- `src/server/db/migrate-and-seed.ts`
  - Imports `./sqlite-schema.js`
  - Creates SQLite tables and seeds sample users, courses, notes, assignments, quizzes, forum content, and analytics snapshots

### 6.2 Callers/importers of target files

CONFIRMED:
- `studyhub-sqlite.ts`
  - Called by `src/server/entry.ts` as `app.use("/api", studyhubSqlite)`
- `studyhub-proxy.ts`
  - No import found in the current runtime entry path
  - No route registration found in inspected runtime files
- `studyhub-data.ts`
  - No import found in the current runtime entry path
  - No route registration found in inspected runtime files
- `sqlite-client.ts`
  - No current import found in the runtime request flow
  - Its only direct usage appears to be as a db helper artifact alongside `sqlite-schema.ts`
- `sqlite-schema.ts`
  - Imported by `src/server/db/migrate-and-seed.ts`
  - Imported by `src/server/db/sqlite-client.ts`
- `db/client.ts`
  - Not mounted in `src/server/entry.ts`
  - Only referenced by a shutdown import attempt in `src/server/entry.ts` (`./db/client.js`) to close database connections if present
- `db/config.ts`
  - Used by `drizzle.config.ts`
  - Used by `src/server/db/client.ts`
- `db/schema.ts`
  - Imported by `src/server/db/client.ts`
  - Currently empty (`export {};`)

## 7. Environment Variable Map

CONFIRMED actual code references:
- `DB_PATH`
  - `src/server/api/studyhub-sqlite.ts`
  - `src/server/db/migrate-and-seed.ts`
  - `src/server/db/sqlite-client.ts`
- `PYTHON_API_URL`
  - `src/server/api/studyhub-proxy.ts`
- `NOMAD_TASK_DIR`
  - `src/server/db/config.ts`
- `PORT`
  - `src/server/entry.ts`
  - `vite.config.ts`
- `HOST`
  - `src/server/entry.ts`
  - `vite.config.ts`
- `GODADDY_API_BASE_URL`
  - `src/server/entry.ts`
- `VITE_GODADDY_API_HOST`
  - `src/server/entry.ts`
- `FRONTEND_DOMAIN`
  - `vite.config.ts`
- `ALLOWED_ORIGINS`
  - `vite.config.ts`
- `VITE_PARENT_ORIGIN`
  - `vite.config.ts`

CONFIRMED:
- `env.example` documents additional environment variables (`VITE_APP_NAME`, `VITE_PUBLIC_URL`, `VITE_API_URL`, `NODE_ENV`, `VITE_ENABLE_SOURCE_MAPPING`, `VITE_ENABLE_SSR`, etc.), but the inspected runtime code only directly references the variables listed above.

INFERRED:
- The runtime environment is partially defined by both runtime code and the generic template defaults in `env.example`.

REQUIRES VERIFICATION:
- Whether any deployment config injects additional env vars that are consumed outside the inspected repository.

## 8. Existing Test Coverage

### 8.1 Existing test files found

CONFIRMED:
- `src/server/entry.test.ts`
- `src/server/adsense-manifest.test.ts`
- `src/server/llms-txt.test.ts`
- `src/server/indexnow-key.test.ts`
- `src/server/seo-host.test.ts`
- `src/components/__tests__/FormattedBoundText.test.tsx`
- `src/components/__tests__/CookieBanner.test.tsx`
- `src/components/ui/__tests__/carousel.test.tsx`
- `src/lib/__tests__/analytics-consent.test.ts`
- `src/lib/__tests__/format-overrides-store.test.ts`
- `src/lib/__tests__/format-overrides.test.ts`
- `src/lib/__tests__/format-overrides-plugin.test.ts`
- `src/lib/__tests__/airo-video-slots-reverse.test.ts`

### 8.2 Available npm scripts

CONFIRMED from `package.json`:
- `dev`
- `build`
- `preview`
- `test`
- `test:ui`
- `test:coverage`
- `audit`
- `lint`
- `lint:fix`
- `type-check`
- `format`
- `clean`
- `reset`

### 8.3 Confirmed missing test coverage areas

CONFIRMED:
- No existing tests for `src/server/api/studyhub-sqlite.ts` auth and authorization enforcement.
- No existing tests for protected routes such as `/study-plan`, `/analytics`, `/user/me`, `/admin/*`.
- No existing tests for fallback and proxy behavior in `src/server/api/studyhub-proxy.ts`.
- No existing tests for input validation or malformed payload handling in the SQLite routes.
- No existing tests for the `studyhub-data.ts` fallback router.
- No existing tests for the `db/client.ts` (MySQL) path, which is currently not wired into runtime request handling.

## 9. Confirmed Problems

CONFIRMED:
1. The current `/api` runtime is SQLite-backed and mounted by `src/server/entry.ts`, but the route handlers do not enforce authenticated access on user-scoped endpoints.
2. `src/server/api/studyhub-sqlite.ts` uses `const userId = (req as any).userId || 'u1';` on several sensitive routes, so a missing auth context falls back to a hardcoded user.
3. `src/pages/login.tsx` stores `data.user` in browser storage and uses `data.user.role` for navigation, without evidence of server-issued session/token verification.
4. `src/lib/api.ts` advertises a `{ token: string; user: User }` response contract, but the current SQLite login/register handlers return `user` and `message` without a token.
5. `src/server/api/studyhub-proxy.ts` does not validate upstream response status or timeout, and it silently falls back to the next handler on any catch.
6. `src/server/api/studyhub-data.ts` and `src/server/api/studyhub-proxy.ts` are not currently mounted by the server entry, so they are not active in the inspected runtime path.
7. `src/server/db/client.ts` and `src/server/db/config.ts` define a MySQL/Drizzle configuration path that is not the route currently mounted by `src/server/entry.ts`.
8. `src/server/db/schema.ts` is an empty stub, so the MySQL Drizzle schema is not currently populated.
9. `drizzle.config.ts` points at the empty `schema.ts`, which means any configured Drizzle migration generation would currently produce an empty schema target.

## 10. Unknowns Requiring Verification

REQUIRES VERIFICATION:
- Whether a real authentication/session backend exists outside the inspected repository.
- Whether the Python FastAPI service exists in deployment and what routes it serves.
- Whether the in-memory fallback data in `studyhub-data.ts` is intentionally part of a demo/fallback contract or just dormant code.
- Whether the MySQL/Drizzle path should remain in the project or be removed as unused legacy code.
- Whether `src/server/db/sqlite-client.ts` is intended as a reusable helper or whether it is orphaned code.
- Whether the project relies on `NOMAD_TASK_DIR`/`/local/config.json` in deployment, or whether those are only local platform artifacts.

## 11. Safe Implementation Order

This section is intentionally limited to verification order, not code changes.

1. CONFIRMED first priority:
   - Verify whether the intended production auth model is session-based, token-based, or external to this repository.
   - Verify whether the `req.userId || 'u1'` fallback is intended for demo mode or is actually a bug.

2. CONFIRMED second priority:
   - Verify the actual deployment shape of the Python proxy and fallback data paths.
   - Confirm whether the MySQL/Drizzle path is legitimate or legacy.

3. CONFIRMED third priority:
   - Verify whether the `studyhub-sqlite.ts` route contract is the contract the UI expects at runtime.
   - Confirm route-level error behaviors and request inputs against the actual client callers.

4. CONFIRMED fourth priority:
   - Verify all environment variables that are truly required in production.
   - Verify the current test coverage gaps before any architecture changes are made.

5. CONFIRMED final verification step:
   - Re-run the existing `type-check`, `lint`, and `test` commands after any architectural decision is made, so the runtime baseline remains evidence-based.
