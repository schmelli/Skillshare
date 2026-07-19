---
phase: 01-foundation-access-control
plan: 03
subsystem: auth
tags: [better-auth, nestjs, fastify, prisma, react-hook-form, zod, shadcn, tanstack-router]

# Dependency graph
requires:
  - phase: 01-foundation-access-control
    provides: "pnpm+Turborepo monorepo, NestJS 11+Fastify API skeleton, React 19+Vite dashboard skeleton (Plan 01); Prisma 7 schema with better-auth's core User/Session/Account/Verification tables already migrated, apps/api/.env convention (Plan 02)"
provides:
  - "better-auth instance (emailAndPassword, prismaAdapter, trustedOrigins) mounted via a framework-agnostic auth.handler catch-all route — NOT @thallesp/nestjs-better-auth"
  - "SessionGuard: the single server-side session-validation point (auth.api.getSession) every future protected route reuses"
  - "packages/shared/src/dto/auth.ts: signUpDto/signInDto Zod schemas with no role field (mass-assignment prohibition), exported from @skillshare/shared"
  - "apps/web: better-auth React client, register/login forms (shadcn Form/Input/Button/Card, hand-authored), _authenticated guarded layout route"
  - "RawBodyParserInitializer pattern: overriding Fastify's default JSON content-type parser so better-auth (not Fastify) owns the raw request body"
affects: [01-04, 01-05]

# Tech tracking
tech-stack:
  added: ["better-auth@1.6.23", "react-hook-form@^7.82.0", "@hookform/resolvers@^5.4.0", "@radix-ui/react-label@^2.1.11", "@radix-ui/react-slot@^1.3.0", "class-variance-authority@^0.7.1", "zod@^4.4.3", "@testing-library/jest-dom@6.9.1"]
  patterns:
    - "better-auth mounted via `@All('/api/auth/*')` + hand-written FastifyRequest<->standard-Request conversion (RESEARCH.md Pattern 1), not the [SUS]-flagged @thallesp/nestjs-better-auth"
    - "auth.ts loads apps/api/.env itself via process.loadEnvFile at module top — its top-level `new PrismaClient()` runs at CommonJS require() time, before ConfigModule.forRoot() populates process.env, unlike PrismaService's lazily-constructed-in-constructor PrismaPg adapter"
    - "AuthModule's RawBodyParserInitializer (OnModuleInit + HttpAdapterHost) overrides Fastify's own default 'application/json' content-type parser with a raw-buffer passthrough — Nest's bodyParser:false only disables *Nest's* parser registration, Fastify's built-in default parser still runs and would otherwise consume the request stream before AuthController/auth.handler can read it"
    - "shadcn/ui components hand-authored under apps/web/src/components/ui/ (button, input, label, card, form) since ui.shadcn.com is unreachable from this sandbox's egress proxy (403) — same pattern as Plan 01's hand-authored components.json/index.css"
    - "TanStack Router guarded layout: apps/web/src/routes/_authenticated.tsx (beforeLoad session check + redirect) with the dashboard content moved to apps/web/src/routes/_authenticated/index.tsx"
    - "Route components exported by name (not just via Route.options.component) so they're testable in isolation without the generated route tree"

key-files:
  created:
    - apps/api/src/auth/auth.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/session.guard.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/test/auth.e2e-spec.ts
    - packages/shared/src/dto/auth.ts
    - apps/web/src/lib/auth-client.ts
    - apps/web/src/routes/login.tsx
    - apps/web/src/routes/register.tsx
    - apps/web/src/routes/_authenticated.tsx
    - apps/web/src/routes/_authenticated/index.tsx
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/input.tsx
    - apps/web/src/components/ui/label.tsx
    - apps/web/src/components/ui/card.tsx
    - apps/web/src/components/ui/form.tsx
    - apps/web/test/login.test.tsx
    - apps/web/test/register.test.tsx
    - apps/web/test/setup.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/package.json
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/vitest.config.ts
    - packages/shared/src/index.ts
    - packages/shared/package.json
  deleted:
    - apps/web/src/routes/index.tsx (moved to apps/web/src/routes/_authenticated/index.tsx — git recorded as a rename)

key-decisions:
  - "Fastify's own built-in default JSON content-type parser still runs even with Nest's bodyParser:false (that flag only skips Nest's own parser registration) — it silently consumed the request body before AuthController could read it. Fixed by registering a raw-buffer-passthrough override for 'application/json' via AuthModule's RawBodyParserInitializer (OnModuleInit + HttpAdapterHost), scoped app-wide for this phase since no other route yet consumes a JSON body via @Body(). A future phase adding one should scope this to an encapsulated /api/auth Fastify plugin instead."
  - "auth.ts loads apps/api/.env itself (process.loadEnvFile), matching prisma.config.ts/test/setup.ts's established pattern, because its top-level `new PrismaClient()` executes at CommonJS require() time — before ConfigModule.forRoot() has populated process.env — unlike PrismaService, whose PrismaPg construction happens lazily inside its constructor at DI-instantiation time (after env vars are loaded). Confirmed via a real dist/main.js boot: without this fix, sign-up failed with a Prisma 'User was denied access on the database (not available)' error from an undefined DATABASE_URL."
  - "shadcn/ui components (button/input/label/card/form) hand-authored under apps/web/src/components/ui/ rather than via `npx shadcn add` — the sandbox's egress proxy returns a hard 403 for ui.shadcn.com (same limitation Plan 01 hit for `shadcn init`). Added react-hook-form, @hookform/resolvers, @radix-ui/react-label, @radix-ui/react-slot, and class-variance-authority as the standard shadcn Form/Button dependency set; each verified as a legitimate, multi-year-old, official-repo package via `npm view` before installing (not in CLAUDE.md's locked table explicitly, but implied by the already-locked 'shadcn/ui + Tailwind CSS' row)."
  - "apps/web/src/routes/index.tsx moved to apps/web/src/routes/_authenticated/index.tsx (git recorded as a rename, not a raw delete) so the health/dashboard landing sits behind the new guarded layout route — required by TanStack Router's file-based routing convention for nesting a route under a pathless layout (_authenticated.tsx). Flagged per the parallel-execution deletion-avoidance guidance; this is a genuine move required by the plan's own 'move the health landing under it' instruction, not an incidental deletion."
  - "register.tsx distinguishes the specific 422 (USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL) duplicate-registration error from all other server errors — only the 422 case shows the UI-SPEC's duplicate-email copy; every other server/network failure falls back to the generic 'Something went wrong' copy, so an unrelated 500 error is never mislabeled as a duplicate account."
  - "Added @testing-library/jest-dom (6.9.1, official testing-library org package, 2019-origin) + apps/web/test/setup.ts to get `.toBeDisabled()`-style DOM matchers, needed to assert the submit-button loading state cleanly in the new component tests."

patterns-established:
  - "better-auth's dedicated module-level PrismaClient (in auth.ts) needs its own explicit env-loading at the top of the file — any future better-auth-adjacent module-scope singleton in this codebase should follow the same process.loadEnvFile pattern, not assume ConfigModule has already run."
  - "Fastify content-type parser overrides live in a dedicated OnModuleInit provider (RawBodyParserInitializer) injected via HttpAdapterHost, applied identically whether the app boots via main.ts's bootstrap() or a test's moduleRef.createNestApplication() — no divergence between prod and e2e-test bootstrapping."
  - "Route components in apps/web/src/routes/*.tsx are exported by name in addition to the default `Route` const specifically so component tests can render them directly, mocking only `@tanstack/react-router`'s `useNavigate`/`Link` rather than needing a full router context."

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "A new user can register with email + password and log in, reaching an authenticated session (auth.e2e-spec happy path)"
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: "apps/api/test/auth.e2e-spec.ts#registers, logs in, and returns the user's email on a session-scoped request"
        status: pass
      - kind: integration
        ref: "manual: node dist/main.js && curl -X POST /api/auth/sign-up/email -> 200 with Set-Cookie session token (verified against the real running server + local Postgres)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Registering the same email twice creates exactly one user row; the second attempt errors"
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: "apps/api/test/auth.e2e-spec.ts#rejects a duplicate registration and creates exactly one user row"
        status: pass
    human_judgment: false
  - id: D3
    description: "An invalid login does not disclose which field (email vs. password) was wrong — same ambiguous error for a wrong password and a nonexistent email"
    requirement: AUTH-01
    verification:
      - kind: e2e
        ref: "apps/api/test/auth.e2e-spec.ts#gives an ambiguous error for an invalid login (does not reveal which field failed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "better-auth is mounted via the framework-agnostic auth.handler catch-all route (not @thallesp/nestjs-better-auth); SessionGuard validates every protected request via auth.api.getSession"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "grep: apps/api/src/auth/auth.controller.ts contains 'auth.handler'; apps/api/src/auth/session.guard.ts contains 'getSession'; no package.json in the repo contains '@thallesp/nestjs-better-auth'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The public sign-up/sign-in DTOs (packages/shared/src/dto/auth.ts) contain only email/password(+name) — no role field"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "grep: packages/shared/src/dto/auth.ts contains 'email', does not contain 'role'"
        status: pass
      - kind: automated_ui
        ref: "apps/web/test/register.test.tsx#does not render a role field anywhere in the form (mass-assignment prohibition)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Register/login forms show the UI-SPEC's loading (spinner + disabled submit), error (ambiguous login / duplicate-email), long-text (email overflow-x-auto), and generic-failure states"
    requirement: AUTH-01
    verification:
      - kind: automated_ui
        ref: "apps/web/test/login.test.tsx (5 tests: ambiguous copy x2, loading spinner+disable, generic failure, long-text overflow class)"
        status: pass
      - kind: automated_ui
        ref: "apps/web/test/register.test.tsx (6 tests: duplicate-email copy, loading spinner+disable, generic failure x2, long-text overflow class, no role field)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The dashboard's authenticated landing route requires a valid session (unauthenticated access redirects to /login)"
    verification: []
    human_judgment: true
    rationale: "The _authenticated.tsx beforeLoad guard and route-tree wiring were verified via a clean pnpm build (routeTree.gen.ts regenerated, tsc --noEmit clean) and code review, but the actual browser redirect behavior was not exercised with a headless browser in this sandbox — consistent with Plan 01/02's own precedent (Playwright browser binaries are not cached here, and downloading them risks the same egress-proxy block already hit for Docker/ui.shadcn.com). A human or CI environment with browser access should confirm visiting `/` while logged out redirects to `/login`."

duration: 20min
completed: 2026-07-19
status: complete
---

# Phase 1 Plan 3: better-auth Register/Login Summary

**better-auth email+password registration and login mounted via a hand-written Fastify `auth.handler` catch-all (not the SUS-flagged `@thallesp/nestjs-better-auth`), a `SessionGuard` reused by every future protected route, and shadcn-styled register/login forms with UI-SPEC-exact loading/error/long-text states.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-19T16:39:00Z
- **Completed:** 2026-07-19T16:58:35Z
- **Tasks:** 3 (Task 1 `tdd="true"`: RED test, then Task 2's GREEN implementation; Task 3 added error/loading/long-text states + component tests)
- **Files modified:** 31 (18 created, 7 modified, 1 moved/renamed, across the 3 task commits + this metadata commit)

## Accomplishments

- `apps/api/src/auth/auth.ts`: better-auth instance (`emailAndPassword`, `prismaAdapter` over a dedicated `PrismaClient`+`PrismaPg` adapter, `trustedOrigins`) — self-loads `apps/api/.env` since its top-level `PrismaClient` construction runs before `ConfigModule.forRoot()`
- `apps/api/src/auth/auth.controller.ts`: framework-agnostic `@All('/api/auth/*')` mount converting `FastifyRequest` -> standard `Request` -> `auth.handler` -> `FastifyReply`, verified end-to-end against a real running server (curl sign-up returned 200 + session cookie)
- `apps/api/src/auth/session.guard.ts`: `SessionGuard` — the single server-side session-validation point (`auth.api.getSession`), deny-by-default
- `apps/api/src/auth/auth.module.ts`: also fixes a subtle Fastify-vs-Nest body-parsing gap (`RawBodyParserInitializer`) — Fastify's own default JSON parser still runs under Nest's `bodyParser:false` and would otherwise consume the request stream before `auth.handler` sees it
- `packages/shared/src/dto/auth.ts`: `signUpDto`/`signInDto` Zod schemas — email+password(+name) only, no `role` field
- `apps/web`: `auth-client.ts` (better-auth React client), `register.tsx`/`login.tsx` (shadcn Form/Input/Button/Card, hand-authored since `ui.shadcn.com` is unreachable from this sandbox), `_authenticated.tsx` guarded layout route with the health/dashboard landing moved under it
- `auth.e2e-spec.ts` (3 tests, Task 1's RED contract) GREEN: register→login→session round-trip, exactly-one-user-row on duplicate registration, ambiguous invalid-login error
- 11 new component tests (`login.test.tsx` + `register.test.tsx`) covering loading/error/long-text/generic-failure states and the "no role field" mass-assignment check
- `pnpm turbo build test lint` — 9/9 tasks green across all 3 packages

## Task Commits

1. **Task 1: Failing auth e2e test (register → login → session; duplicate rejected)** - `ed2ad4f` (test) — RED: 2/3 tests fail with 404 (routes not mounted)
2. **Task 2: better-auth instance + auth.handler mount + SessionGuard + register/login UI (GREEN)** - `bc4f770` (feat) — all 3 auth.e2e-spec tests pass; full `pnpm turbo build test lint` green
3. **Task 3: Auth error/loading/long-text states + enumeration copy** - `2ad12f4` (test) — 11 new component tests, all passing

**Plan metadata:** (this commit, made by the worktree's `git_commit_metadata` step in worktree mode — SUMMARY.md + REQUIREMENTS.md only)

## Files Created/Modified

- `apps/api/src/auth/{auth.ts,auth.controller.ts,session.guard.ts,auth.module.ts}` — better-auth wiring, Fastify request/response adaptation, session guard, raw-body parser override
- `apps/api/src/app.module.ts` — registers `AuthModule`
- `apps/api/test/auth.e2e-spec.ts` — 3 e2e tests (happy path, duplicate registration, ambiguous invalid login)
- `packages/shared/src/dto/auth.ts` + `src/index.ts` — public sign-up/sign-in Zod DTOs, no role field
- `apps/web/src/lib/auth-client.ts` — better-auth React client
- `apps/web/src/routes/{login.tsx,register.tsx}` — auth forms with UI-SPEC copy/loading/error/long-text states
- `apps/web/src/routes/_authenticated.tsx` + `_authenticated/index.tsx` — guarded layout route; health landing moved under it
- `apps/web/src/components/ui/{button,input,label,card,form}.tsx` — hand-authored shadcn components
- `apps/web/test/{login.test.tsx,register.test.tsx,setup.ts}` — component tests + jest-dom setup
- `apps/api/package.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `packages/shared/package.json` — dependency/tooling additions

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: (1) fixed a Fastify-default-JSON-parser-vs-Nest-bodyParser-false gap that silently broke `auth.handler`'s body reading; (2) `auth.ts` self-loads `.env` because its module-scope `PrismaClient` predates `ConfigModule`; (3) hand-authored shadcn components since `ui.shadcn.com` is unreachable from this sandbox; (4) moved (not copy-duplicated) `index.tsx` under the new `_authenticated` layout per TanStack Router's file-based routing convention; (5) `register.tsx` only shows the duplicate-email copy for the specific 422 case, falling back to generic-failure copy otherwise; (6) added `@testing-library/jest-dom` for cleaner loading-state assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `new Request()` construction from a piped `Readable.toWeb(req.raw)` stream threw "Response body object should not be disturbed or locked"**
- **Found during:** Task 2 (first `auth.e2e-spec` run after wiring `auth.controller.ts`)
- **Issue:** The initial `toWebRequest` implementation piped Fastify's raw `IncomingMessage` directly into `new Request(url, {body: Readable.toWeb(req.raw), duplex: "half"})`; Node's undici-backed `Request` constructor threw a "disturbed or locked" `TypeError` for this stream shape in this runtime.
- **Fix:** Buffered the request body in memory before constructing the `Request` object instead of streaming it. Auth payloads (email/password JSON) are small, so this has no meaningful cost.
- **Files modified:** `apps/api/src/auth/auth.controller.ts`
- **Verification:** `auth.e2e-spec.ts` progressed from a 500 error to a 400 (next issue, below)
- **Committed in:** `bc4f770` (Task 2)

**2. [Rule 1 - Bug] Fastify's own default JSON content-type parser silently consumed the request body before `auth.handler` could read it**
- **Found during:** Task 2 (`auth.e2e-spec` still failing after the buffering fix, with `better-auth` reporting "[body] Invalid input: expected object, received undefined")
- **Issue:** NestJS's `bodyParser: false` (set in `main.ts` since Plan 01, specifically anticipating this) only skips *Nest's own* body-parser registration — Fastify's own built-in default `application/json` content-type parser still runs unconditionally, consuming and JSON-parsing the raw request stream before `AuthController`'s handler ever executed, leaving nothing for the hand-rolled body-buffering to read.
- **Fix:** Added `AuthModule`'s `RawBodyParserInitializer` (`OnModuleInit` + `HttpAdapterHost`), which overrides Fastify's default `'application/json'` parser with a raw-buffer passthrough (`{ parseAs: "buffer" }`) — Fastify explicitly supports overriding its own built-in JSON/text default parsers without a "custom parser conflict" error. `auth.controller.ts`'s `toWebRequest` now reads the already-buffered `req.body` directly instead of re-reading a (now-consumed) raw stream.
- **Files modified:** `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/auth.controller.ts`
- **Verification:** `auth.e2e-spec.ts` all 3 tests pass (GREEN); confirmed also via a real `node dist/main.js` boot + curl sign-up (200, session cookie set)
- **Committed in:** `bc4f770` (Task 2)

**3. [Rule 1 - Bug] better-auth's Prisma adapter failed with "User was denied access on the database (not available)" when running the compiled `dist/main.js`**
- **Found during:** Task 2's manual end-to-end verification (`node dist/main.js` + curl), after `auth.e2e-spec.ts` was already GREEN under Vitest
- **Issue:** `auth.ts`'s top-level `const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` executes at CommonJS `require()` time — before `NestFactory.create(AppModule)` runs `ConfigModule.forRoot()`, which is what actually populates `process.env` from `.env` in the compiled app. `DATABASE_URL` was `undefined` at construction time, so the driver adapter couldn't connect. The Vitest e2e suite masked this because `test/setup.ts` (a `setupFiles` entry) already calls `process.loadEnvFile` before any test file's imports resolve.
- **Fix:** Added the same `process.loadEnvFile(path.join(__dirname, "..", "..", ".env"))` (try/catch, optional) pattern already established in `prisma.config.ts`/`test/setup.ts`, at the top of `auth.ts` itself.
- **Files modified:** `apps/api/src/auth/auth.ts`
- **Verification:** Rebuilt (`nest build`) and re-ran `node dist/main.js`; `curl -X POST /api/auth/sign-up/email` returned 200 with a `Set-Cookie` session token and a real user row (confirmed via `psql`)
- **Committed in:** `bc4f770` (Task 2)

**4. [Rule 3 - Blocking] `ui.shadcn.com` unreachable from this sandbox's egress proxy (403), same limitation as Plan 01's `shadcn init`**
- **Found during:** Task 2 (attempting `npx shadcn@latest add button input label form card`)
- **Issue:** The CLI failed with "Request was cancelled" / a `403 CONNECT tunnel failed` from the sandbox's egress proxy when fetching component definitions from `ui.shadcn.com`.
- **Fix:** Hand-authored `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `form.tsx` under `apps/web/src/components/ui/` matching the classic shadcn `new-york` source (already-verified `components.json` schema from Plan 01), and installed the standard supporting dependencies (`react-hook-form`, `@hookform/resolvers`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `class-variance-authority`) — each verified as a legitimate, official-repo, multi-year-old package via `npm view <pkg> repository.url time.created` before installing.
- **Files modified:** `apps/web/src/components/ui/{button,input,label,card,form}.tsx`, `apps/web/package.json`
- **Verification:** `pnpm --filter @skillshare/web run build`/`typecheck` both exit 0; forms render and function correctly per the component tests
- **Committed in:** `bc4f770` (Task 2)

**5. [Rule 2 - Missing Critical] `packages/shared` and `apps/web` needed an explicit `@skillshare/shared` workspace dependency to resolve at build time**
- **Found during:** Task 2 (first `vite build` after adding `login.tsx`'s `import { signInDto } from "@skillshare/shared"`)
- **Issue:** `apps/web/package.json` had no dependency entry for `@skillshare/shared`, so Rollup failed to resolve the import even though pnpm workspaces link the package on disk.
- **Fix:** `pnpm add @skillshare/shared@workspace:*` in `apps/web`.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Verification:** `vite build` succeeds; `tsc --noEmit` clean
- **Committed in:** `bc4f770` (Task 2)

---

**Total deviations:** 5 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking/environment limitation, 1 Rule 2 missing-critical dependency). All were necessary for the plan's stated deliverables to actually function; none represent scope creep or an architectural change.
**Impact on plan:** Every acceptance criterion in the plan was still met — `@thallesp/nestjs-better-auth` was never added, the public DTO carries no `role` field, and `auth.e2e-spec.ts` is fully GREEN.

## Issues Encountered

- `apps/api/.env` did not exist in this fresh worktree checkout (gitignored, not committed) — recreated it with `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`WEB_ORIGIN` pointing at the same local Postgres 16 instance Plan 02 already migrated (`postgresql://postgres:postgres@localhost:5432/skillshare`), consistent with the `<environment_reality>` guidance for this plan.
- The TanStack Router Vite plugin's `autoCodeSplitting` no longer splits `login.tsx`/`register.tsx` into their own small chunks after they gained a second named export (`LoginPage`/`RegisterPage`, added for testability) — they're now bundled into the main `index-*.js` chunk instead of tiny per-route chunks. Purely a bundle-size/code-splitting-granularity tradeoff (verified the app still builds and functions correctly), not a functional regression; flagged for awareness if a later phase cares about route-level lazy-loading precision.
- Docker/Postgres-in-Docker was not exercised in this sandbox — same carried-forward limitation as Plan 01's D6/Plan 02's D7 (Docker Hub egress blocked); this plan continued using the local Postgres 16 instance both plans already established.

## User Setup Required

None — no external service configuration required. `apps/api/.env` (gitignored) was recreated in this session with a real generated `BETTER_AUTH_SECRET`; a fresh clone/environment needs to copy `.env.example` to `apps/api/.env` and point `DATABASE_URL` at wherever Postgres actually runs, same as Plan 02 already documented.

## Next Phase Readiness

- Registration, login, session validation (`SessionGuard`), and the public no-role DTO contract are all proven end-to-end (e2e tests + a real running-server curl check). Plan 04/05 (workspace CRUD, per-workspace role grants) can build directly on `SessionGuard`, `auth.api.getSession`, and the existing `Tenant`/`Workspace`/`Membership` Prisma models from Plan 02.
- **Carried forward from Plan 01/02:** `docker compose up -d postgres` reporting healthy against the real `postgres:18` container (not the local PG16 substitute used across all three plans in this sandbox) still needs a human/CI environment with normal Docker Hub egress to confirm, before Phase 1's DEPL-03 requirement is considered fully proven against the real deployment target.
- **New for this plan:** the `_authenticated` layout route's actual browser-level redirect-when-logged-out behavior (D7 above) was verified via build/typecheck/code review only, not a headless browser — flagged `human_judgment: true` for `/gsd-verify-work` to confirm visually.
- Plan 05 (per-workspace role grants) should reuse `SessionGuard` as the base and layer a `WorkspaceRoleGuard` on top, per RESEARCH.md's Architecture Patterns — `Membership` and better-auth's own `Member`/`Organization` tables are still not wired together (RESEARCH.md Open Question 1, carried forward from Plan 02).

---
*Phase: 01-foundation-access-control*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 20 referenced files (auth backend, shared DTO, web auth UI/components, tests, this SUMMARY) confirmed present on disk; all 3 referenced task commit hashes (`ed2ad4f`, `bc4f770`, `2ad12f4`) confirmed present in `git log`.
