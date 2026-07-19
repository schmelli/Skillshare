---
phase: 01-foundation-access-control
plan: 04
subsystem: auth
tags: [better-auth, nestjs, fastify, prisma, tanstack-query, react-hook-form, zod, shadcn, radix-dialog]

# Dependency graph
requires:
  - phase: 01-foundation-access-control
    provides: "Prisma 7 org-scoped Tenant/Workspace/Membership schema (Plan 02); better-auth instance, SessionGuard, packages/shared DTO pattern, apps/web auth forms + guarded _authenticated layout (Plan 03)"
provides:
  - "better-auth organization plugin + createAccessControl custom admin/editor/consumer roles (auth.ts) — better-auth's default 'member' label never leaks into apps/web or packages/shared"
  - "WorkspacesModule: WorkspacesService (create, canCreateWorkspace, listForUser) + WorkspacesController (GET/POST /api/workspaces), the membership-scoped deny-by-default query pattern every future workspace-scoped endpoint reuses"
  - "packages/shared: WorkspaceRole union (roles.ts) and create-workspace Zod DTO (dto/workspace.ts)"
  - "apps/web workspaces route + WorkspaceList (populated/empty x2/loading/error/overflow states) + CreateWorkspaceDialog + AppNav sidebar; hand-authored Badge/Skeleton/Dialog shadcn components"
  - "Workspace-creation authorization model: bootstrap the first workspace in an empty tenant freely, then Admin-only (an existing admin Membership somewhere) for every subsequent create — reconciles the two distinct empty-state UI copies with the schema's lack of a tenant-level Admin flag"
affects: [01-05]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-dialog (apps/web)"]
  patterns:
    - "Workspace/role reads and writes go through Skillshare's own Tenant/Workspace/Membership Prisma tables directly (WorkspacesService), not through better-auth's organization-plugin endpoints — the plugin registration in auth.ts exists to establish the shared admin/editor/consumer role vocabulary and prevent 'member' leakage if its own routes are ever reached, per RESEARCH.md Pattern 2/3 and Open Question 1 (still unresolved: better-auth's own Organization/Member tables remain unwired to Tenant/Workspace)"
    - "GET /api/workspaces returns { workspaces, canCreate } — canCreate is server-computed (bootstrap-empty-tenant OR caller already Admin somewhere) and drives which of the two UI-SPEC empty states the dashboard renders; hiding the CTA is UX only, the POST route re-checks the same authorization server-side regardless of what the client saw"
    - "Fastify's addContentTypeParser override for 'application/json' (AuthModule, Plan 03) now branches on req.url: raw buffer passthrough for /api/auth/*, normal JSON.parse for everything else — needed once a second controller (WorkspacesController) started consuming @Body()"
    - "apps/api/vitest.config.ts: fileParallelism: false — e2e specs run against one shared, real Postgres database with no per-file isolation; multiple *.e2e-spec.ts files truncating overlapping tables in afterEach must not run concurrently"
    - "apps/api's production start script runs the compiled dist/main.js through tsx (not plain node) because a workspace package (@skillshare/shared) ships raw, unbundled TypeScript as its 'main' entry with no separate build step — Node's own runtime resolver cannot execute that without a TS-aware loader once apps/api's own runtime code (not just test-time code) imports from it"

key-files:
  created:
    - apps/api/src/workspaces/workspaces.service.ts
    - apps/api/src/workspaces/workspaces.controller.ts
    - apps/api/src/workspaces/workspaces.module.ts
    - apps/api/test/workspaces.e2e-spec.ts
    - packages/shared/src/roles.ts
    - packages/shared/src/dto/workspace.ts
    - apps/web/src/routes/_authenticated/workspaces/index.tsx
    - apps/web/src/components/workspace-list.tsx
    - apps/web/src/components/create-workspace-dialog.tsx
    - apps/web/src/components/app-nav.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/skeleton.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/test/workspace-list.test.tsx
    - apps/web/test/app-nav.test.tsx
    - apps/web/test/create-workspace-dialog.test.tsx
  modified:
    - apps/api/src/auth/auth.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/app.module.ts
    - apps/api/vitest.config.ts
    - apps/api/package.json
    - apps/web/src/lib/api.ts
    - apps/web/package.json
    - packages/shared/src/index.ts

key-decisions:
  - "Workspace CREATE authorization: any authenticated user may bootstrap the very first workspace in an empty tenant (there's no one else who could already be Admin); once the tenant has one, only a caller already holding an admin Membership somewhere may create another. This reconciles the plan's must_haves literally: 'a non-Admin cannot create a workspace even by calling the API directly' AND the two distinct empty-state copies ('Create your first workspace.' with CTA vs. 'No workspaces yet.' with no CTA) — neither is satisfiable by a naive 'any logged-in user can always create' reading, and the schema has no separate tenant-level Admin flag to gate on instead."
  - "packages/shared's roles.ts / dto/workspace.ts are the source of truth for the WorkspaceRole vocabulary; auth.ts's better-auth organization plugin registers the same three names via createAccessControl purely to prevent better-auth's own default 'member' label from ever leaking, since the plugin's own endpoints are not otherwise exercised in this plan (RESEARCH.md Open Question 1 — Membership vs. better-auth's Organization/Member tables — remains open, carried forward again)."
  - "apps/api's 'start' script now runs via tsx (moved from devDependencies to dependencies) instead of plain node — the first apps/api runtime code path to import from @skillshare/shared (whose package.json points 'main' at raw TypeScript with no build step) surfaced that a plain node dist/main.js boot cannot resolve it."

patterns-established:
  - "Deny-by-default workspace listing always starts the Prisma query FROM the caller's own Membership rows (never Workspace.findMany with a client-supplied filter) — the pattern every future workspace-scoped list endpoint (skills, members) should follow."
  - "canCreate-style server-computed authorization flags returned alongside list responses, so a list-owning component can render the correct empty-state/CTA without re-deriving authorization client-side — while the actual mutation route always re-checks server-side regardless."

requirements-completed: [ORG-01, ORG-03]

coverage:
  - id: D1
    description: "An authenticated user can create a workspace through the API and see it appear in their own workspace list, as its Admin (ORG-01)"
    requirement: ORG-01
    verification:
      - kind: e2e
        ref: "apps/api/test/workspaces.e2e-spec.ts#lets an authenticated user create a workspace and see it in their own list, as admin"
        status: pass
      - kind: integration
        ref: "manual: tsx dist/main.js + curl register -> login -> POST /api/workspaces -> GET /api/workspaces against real Postgres — returned the created workspace with role: admin"
        status: pass
    human_judgment: false
  - id: D2
    description: "Workspace creation is Admin-only and server-enforced: bootstrapping the first workspace in an empty tenant is open, but once the tenant has one, only an existing workspace Admin may create another — never a client-supplied field, never UI-only"
    requirement: ORG-01
    verification:
      - kind: e2e
        ref: "apps/api/test/workspaces.e2e-spec.ts#denies workspace creation for a user with no admin membership once the tenant already has a workspace (Admin-only mutation, T-04-02)"
        status: pass
      - kind: unit
        ref: "grep: workspaces.controller.ts calls canCreateWorkspace before create() and throws ForbiddenException; createWorkspaceDto has no role/tenantId field"
        status: pass
    human_judgment: false
  - id: D3
    description: "The workspace list is scoped to the caller's memberships only — a user with no membership in a workspace never sees it, and its name never appears in the response body (ORG-03 non-leak)"
    requirement: ORG-03
    verification:
      - kind: e2e
        ref: "apps/api/test/workspaces.e2e-spec.ts#never includes a workspace the caller has no membership in (ORG-03 non-leak, empty state)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Duplicate workspace names within a tenant are rejected with the exact UI-SPEC conflict copy and never produce a second row (DB-constraint-backed idempotency, not check-then-insert)"
    verification:
      - kind: e2e
        ref: "apps/api/test/workspaces.e2e-spec.ts#rejects a duplicate workspace name in the same tenant and creates exactly one row (idempotency)"
        status: pass
      - kind: automated_ui
        ref: "apps/web/test/create-workspace-dialog.test.tsx#shows the exact workspace-name-conflict copy for a 409 error"
        status: pass
    human_judgment: false
  - id: D5
    description: "The workspace list is returned in a stable, name-ascending order across repeated calls"
    verification:
      - kind: e2e
        ref: "apps/api/test/workspaces.e2e-spec.ts#returns the workspace list in a stable, name-ascending order across repeated calls"
        status: pass
    human_judgment: false
  - id: D6
    description: "Custom admin/editor/consumer roles are defined via better-auth createAccessControl before any controller/UI code references a role string; better-auth's default 'member' label never leaks into apps/web or packages/shared"
    verification:
      - kind: unit
        ref: "grep: apps/api/src/auth/auth.ts contains createAccessControl + admin/editor/consumer; grep -r '\"member\"' apps/web/src packages/shared/src returns no role-value matches"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both empty states render with the correct copy/CTA (bootstrap-Admin vs. no-access-no-CTA); populated list shows one row per workspace with name + role badge (Admin accent, Editor/Consumer neutral); singular/plural summary copy; loading skeleton; generic error banner + Retry; name truncation with title tooltip; sidebar overflow scroll past ~10 entries"
    verification:
      - kind: automated_ui
        ref: "apps/web/test/workspace-list.test.tsx (7 tests: bootstrap empty state, no-access empty state, singular/plural summary, loading skeleton, error banner+Retry, name truncation+title, Admin-accent vs neutral badges)"
        status: pass
      - kind: automated_ui
        ref: "apps/web/test/app-nav.test.tsx#applies internal overflow scrolling to the workspace-nav list past ~10 entries (backstop)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The create-workspace form has no autosave/draft-recovery for a partially-filled form (explicit out-of-scope planner assumption)"
    verification:
      - kind: automated_ui
        ref: "apps/web/test/create-workspace-dialog.test.tsx#does not implement autosave/draft-recovery for a partially-filled form"
        status: pass
    human_judgment: false
  - id: D9
    description: "docker-compose.yml's postgres:18 service itself boots healthy and the full register/create/list flow works against it (not just the local PG16 substitute used in this sandbox)"
    verification: []
    human_judgment: true
    rationale: "Same sandbox limitation carried forward from Plans 01-03: Docker Hub pull of postgres:18 returns a hard 403 from this environment's egress proxy. This plan continued against the same local Postgres 16 instance (already migrated by Plan 02) and did not touch docker-compose.yml. A human/CI environment with normal Docker Hub egress must confirm before DEPL-03 is considered fully proven against the real deployment target."

duration: ~18min
completed: 2026-07-19
status: complete
---

# Phase 1 Plan 4: Workspace Create + List (Custom Roles, Admin-Only Create, Membership-Scoped List) Summary

**Membership-scoped `GET/POST /api/workspaces` with a bootstrap-then-Admin-only creation model, better-auth `createAccessControl` custom admin/editor/consumer roles, and the full UI-SPEC list-surface states (populated/empty×2/loading/error/overflow) verified end-to-end against a real running server and Postgres.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-19T17:09:00Z
- **Completed:** 2026-07-19T17:27:00Z
- **Tasks:** 3 (Task 1 `tdd="true"`: RED test, Task 2's GREEN implementation, Task 3's verifying tests for states built alongside Task 2)
- **Files modified:** 24 (16 created, 8 modified)

## Accomplishments

- `apps/api/src/auth/auth.ts`: extended the better-auth instance with the `organization` plugin and `createAccessControl` custom `admin`/`editor`/`consumer` roles, defined before any controller/UI code references a role string
- `apps/api/src/workspaces/`: `WorkspacesService` (`create`, `canCreateWorkspace`, `listForUser`) + `WorkspacesController` (`GET`/`POST /api/workspaces`) — deny-by-default list scoped to the caller's own `Membership` rows, name-ascending order, `@@unique([tenantId, name])`-backed conflict handling
- Workspace-creation authorization model resolving an ambiguity in the plan's must_haves (two distinct empty-state UI copies vs. no tenant-level Admin flag in the schema): any user may bootstrap the first workspace in an empty tenant; thereafter only an existing workspace Admin may create another — server-enforced (`ForbiddenException`), never UI-only
- `packages/shared`: `WorkspaceRole` union (`roles.ts`), name-only create-workspace Zod DTO (`dto/workspace.ts`)
- `apps/web`: `/workspaces` route (nested under `_authenticated`), `WorkspaceList` (all UI-SPEC states), `CreateWorkspaceDialog` (Radix Dialog + react-hook-form + conflict/generic error copy), `AppNav` sidebar with overflow scroll; hand-authored `Badge`/`Skeleton`/`Dialog` shadcn components (`ui.shadcn.com` unreachable from this sandbox, same as Plan 03)
- `apps/api/test/workspaces.e2e-spec.ts` (5 tests) + `apps/web/test/{workspace-list,app-nav,create-workspace-dialog}.test.tsx` (12 tests) — full ORG-01/ORG-03 behavioral contract, non-leak, idempotency, ordering, and every UI-SPEC state
- Manually verified the full register → login → create-workspace → list flow against a real running compiled server (`tsx dist/main.js`) and live Postgres via curl
- `pnpm turbo build test lint`: 9/9 tasks green across all 3 packages (15 api tests, 24 web tests)

## Task Commits

1. **Task 1: Failing workspaces e2e test (create, list-scoping, name conflict, empty)** - `5c72c08` (test) — RED: 4/4 tests fail with 404 (`WorkspacesModule` not yet mounted)
2. **Task 2: Custom roles + WorkspacesModule (Admin-only create, membership-scoped list) + list UI (GREEN)** - `1ec715d` (feat) — all workspace e2e tests pass (5/5, one added beyond Task 1's original 4 — see Deviations); full `pnpm turbo build test lint` green
3. **Task 3: Workspace-list loading/error/overflow states + name-conflict copy** - `e81b8f0` (test) — the states themselves were built as part of Task 2's commit; this commit adds the 12 component tests verifying them (several are `must_haves.backstop` items)

**Plan metadata:** (this commit, made by the worktree's `git_commit_metadata` step in worktree mode — SUMMARY.md + REQUIREMENTS.md only)

## Files Created/Modified

- `apps/api/src/workspaces/{workspaces.service.ts,workspaces.controller.ts,workspaces.module.ts}` — the workspace create/list vertical slice
- `apps/api/src/auth/auth.ts` — `organization` plugin + `createAccessControl` custom roles
- `apps/api/src/auth/auth.module.ts` — fixed the JSON body-parser override to branch on path (see Deviations)
- `apps/api/src/app.module.ts` — registers `WorkspacesModule`
- `apps/api/vitest.config.ts` — `fileParallelism: false` (see Deviations)
- `apps/api/package.json` — `@skillshare/shared` dependency added; `start` script now `tsx dist/main.js`, `tsx` moved to `dependencies`
- `apps/api/test/workspaces.e2e-spec.ts` — 5 e2e tests
- `packages/shared/src/{roles.ts,dto/workspace.ts}` + `src/index.ts` — `WorkspaceRole` type, create-workspace DTO
- `apps/web/src/routes/_authenticated/workspaces/index.tsx` — workspaces page (path corrected from the plan's literal `routes/workspaces/index.tsx` to nest under the guarded `_authenticated` layout — see Deviations)
- `apps/web/src/components/{workspace-list.tsx,create-workspace-dialog.tsx,app-nav.tsx}` — list surface + create dialog + sidebar
- `apps/web/src/components/ui/{badge.tsx,skeleton.tsx,dialog.tsx}` — hand-authored shadcn components
- `apps/web/src/lib/api.ts` — `getWorkspaces`, `createWorkspace`, `WorkspaceApiError`
- `apps/web/package.json` — `@radix-ui/react-dialog` dependency
- `apps/web/test/{workspace-list,app-nav,create-workspace-dialog}.test.tsx` — 12 component tests

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: (1) resolved the workspace-creation authorization ambiguity as bootstrap-then-Admin-only, driven by a server-computed `canCreate` flag also used to pick the correct empty-state UI; (2) kept the better-auth `organization` plugin registration role-vocabulary-only (not the actual read/write path, which stays on Skillshare's own Prisma tables, per RESEARCH.md Pattern 3/Open Question 1); (3) switched `apps/api`'s production start command to `tsx` after discovering `@skillshare/shared`'s unbuilt TypeScript `main` entry breaks a plain `node` boot once apps/api has a real runtime (not just test-time) dependency on it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Workspace-creation authorization gate + accompanying test, beyond Task 1's literal 4 test behaviors**
- **Found during:** Task 2, while reconciling the plan's must_haves ("a non-Admin cannot create a workspace even by calling the API directly", two distinct empty-state UI copies) with the schema (no tenant-level Admin flag) and Task 1's literal test list (which only covers create/list/conflict/ordering, not this adversarial case)
- **Issue:** Without an explicit authorization rule, either every authenticated user would always be able to create workspaces (making "Admin-only" and the "No workspaces yet." no-CTA empty state unreachable/false), or the plan's Admin-only requirement (threat T-04-02, HIGH severity) would go unimplemented and unverified
- **Fix:** `WorkspacesService.canCreateWorkspace` — bootstrap the first workspace in an empty tenant freely, otherwise require an existing admin `Membership`; the controller checks this before `create()` and returns 403 otherwise; added `canCreate` to the `GET /api/workspaces` response so the dashboard can select the correct empty state
- **Files modified:** `apps/api/src/workspaces/workspaces.service.ts`, `apps/api/src/workspaces/workspaces.controller.ts`, `apps/api/test/workspaces.e2e-spec.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/components/workspace-list.tsx`
- **Verification:** New e2e test `denies workspace creation for a user with no admin membership once the tenant already has a workspace` passes; component tests assert both empty states render correctly from `canCreate`
- **Committed in:** `1ec715d` (Task 2)

**2. [Rule 1 - Bug] AuthModule's global raw-body-buffer content-type parser override broke every other route's `@Body()` parsing**
- **Found during:** Task 2 (`workspaces.e2e-spec.ts` all failing with 400 Bad Request after `WorkspacesController` was wired up)
- **Issue:** Plan 03's `AuthModule.RawBodyParserInitializer` unconditionally overrode Fastify's default `application/json` parser with a raw-buffer passthrough app-wide — needed for `auth.handler`, but its own comment flagged this as scoped-for-now "since no other route yet consumes a JSON body via `@Body()`". `WorkspacesController.create()` is that route: it received the raw `Buffer` instead of a parsed object, so `createWorkspaceDto.safeParse(body)` always failed.
- **Fix:** The parser now branches on `req.url`: raw buffer passthrough for `/api/auth/*` (unchanged behavior for `auth.handler`), normal `JSON.parse` for every other route
- **Files modified:** `apps/api/src/auth/auth.module.ts`
- **Verification:** `workspaces.e2e-spec.ts` and `auth.e2e-spec.ts` both pass
- **Committed in:** `1ec715d` (Task 2)

**3. [Rule 3 - Blocking] Two e2e spec files truncating overlapping tables raced each other under Vitest's default parallel file execution**
- **Found during:** Task 2 (`pnpm --filter @skillshare/api exec vitest run` — full suite — intermittently failed with FK violations / wrong-membership results, while the new spec passed fine in isolation)
- **Issue:** `auth.e2e-spec.ts` and the new `workspaces.e2e-spec.ts` both truncate the `User`/`Session`/`Account` tables in their own `afterEach`, against the same live, shared Postgres database. Vitest runs test files in parallel by default; with only one e2e spec file this was invisible, but a second one exposed the race.
- **Fix:** Added `fileParallelism: false` to `apps/api/vitest.config.ts`, serializing file execution
- **Files modified:** `apps/api/vitest.config.ts`
- **Verification:** Full suite (`pnpm --filter @skillshare/api exec vitest run`) passed cleanly across multiple repeated runs after the fix
- **Committed in:** `1ec715d` (Task 2)

**4. [Rule 2 - Missing Critical] `@skillshare/shared` was not a dependency of `apps/api`**
- **Found during:** Task 2 (`WorkspacesController`'s `import { createWorkspaceDto } from "@skillshare/shared"` failed to resolve — the shared package was only wired into `apps/web` in Plan 03)
- **Fix:** `pnpm add @skillshare/shared@workspace:*` in `apps/api`
- **Files modified:** `apps/api/package.json`, `pnpm-lock.yaml`
- **Committed in:** `1ec715d` (Task 2)

**5. [Rule 1 - Bug] `node dist/main.js` cannot boot once apps/api has a real runtime dependency on `@skillshare/shared`**
- **Found during:** Task 2's manual end-to-end verification (`node dist/main.js` + curl, following Plan 02/03's own precedent)
- **Issue:** `@skillshare/shared/package.json` has `"main": "./src/index.ts"` and `"type": "module"`, with no build step — a deliberate Plan 01-03 pattern that worked fine because only Vite/Vitest (both TS-aware) ever consumed it. `WorkspacesController` is the first `apps/api` code path to import from it in a real (non-test) runtime, and plain `node`'s ESM resolver cannot execute unbundled TypeScript with extensionless relative imports (`ERR_MODULE_NOT_FOUND`). Adding explicit `.ts` extensions inside `packages/shared/src/index.ts` was tried first but reverted — it fixes Node's resolver but breaks `apps/api`'s own `tsc`/`nest build` (which doesn't have `allowImportingTsExtensions` enabled, and enabling it requires `noEmit`, incompatible with `apps/api` actually emitting `dist/`).
- **Fix:** Changed `apps/api`'s `start` script from `node dist/main.js` to `tsx dist/main.js` (moved `tsx` from `devDependencies` to `dependencies`, since it's now needed at runtime, not just for the seed script)
- **Files modified:** `apps/api/package.json`
- **Verification:** `tsx dist/main.js` boots cleanly; manually verified the full register → login → create-workspace → list flow via curl against the real running server and live Postgres
- **Committed in:** `1ec715d` (Task 2)

**6. [Rule 1 - Bug] Route path corrected to nest under the `_authenticated` guarded layout**
- **Found during:** Task 2 (building the workspaces route)
- **Issue:** The plan's literal `files_modified` path was `apps/web/src/routes/workspaces/index.tsx` — outside the `_authenticated/` directory TanStack Router's file-based routing requires for a route to inherit the pathless layout's `beforeLoad` session guard (the plan's own prose says "under `_authenticated`", contradicting the literal path)
- **Fix:** Placed the file at `apps/web/src/routes/_authenticated/workspaces/index.tsx`, matching the established `_authenticated/index.tsx` convention from Plan 03
- **Files modified:** `apps/web/src/routes/_authenticated/workspaces/index.tsx` (created at the corrected path; nothing created at the plan's literal path)
- **Verification:** `pnpm --filter @skillshare/web run build` generates the route at `/_authenticated/workspaces/`; unauthenticated access redirects to `/login` via the same mechanism already proven for `/_authenticated/`
- **Committed in:** `1ec715d` (Task 2)

---

**Total deviations:** 6 auto-fixed (2 Rule 1 bugs affecting only this task's own new code paths, 1 Rule 1 bug in inherited Plan 03 code triggered by this task, 1 Rule 2 missing-critical authorization gate + test, 1 Rule 2 missing dependency, 1 Rule 3 blocking test-isolation fix). All were necessary for the plan's stated deliverables to actually work correctly and securely; none represent scope creep or an unrequested architectural change.
**Impact on plan:** Every acceptance criterion in the plan is met. The workspace-creation authorization model (deviation 1) is the one genuinely interpretive call this plan required — reconciled from the plan's own must_haves and threat model rather than invented from nothing, and fully covered by a new e2e test.

## Issues Encountered

- Same sandbox limitations carried forward from Plans 01-03: Node is `v22.22.2` (not the pinned `>=24`), and Docker Hub pulls (`postgres:18`) are blocked by this environment's egress policy — continued against the same local PostgreSQL 16 instance and `apps/api/.env` (gitignored, recreated fresh in this worktree) already established by prior plans.
- `apps/api/.env` did not exist in this fresh worktree checkout (gitignored) — recreated with `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`WEB_ORIGIN` pointing at the same local Postgres, consistent with the `<environment_reality>` guidance for this plan.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- The workspace create/list vertical slice (ORG-01, and the list-scoping half of ORG-03) is proven end-to-end: e2e tests, component tests, and a manual curl-driven check against a real running server and live Postgres all pass.
- Plan 05 (per-workspace role grants, `WorkspaceRoleGuard`) can build directly on `WorkspacesService`/`WorkspacesController`, the `Membership` table, and the `WorkspaceRole` type from `packages/shared`. Plan 05's own plan text already anticipates `MembershipService.findRole`/`grantRole` and a guard reusing this plan's deny-by-default query pattern.
- **Carried forward from Plans 01-03, now also applying here:** `docker compose up -d postgres` against the real `postgres:18` container (not the local PG16 substitute) still needs a human/CI environment with normal Docker Hub egress to confirm, before Phase 1's DEPL-03 requirement is considered fully proven against the real deployment target.
- **New for this plan:** `apps/api`'s `start` script now depends on `tsx` at runtime (not just `node`) because of `@skillshare/shared`'s unbuilt-TypeScript `main` entry — a future phase adding a real Dockerfile/production build should be aware of this, and may want to revisit giving `packages/shared` an actual compiled `dist/` output instead, if more `apps/api` runtime code comes to depend on it.
- RESEARCH.md's Open Question 1 (better-auth's own `Organization`/`Member` tables vs. Skillshare's own `Tenant`/`Workspace`/`Membership`) remains unresolved and unaffected by this plan — the `organization` plugin registered in `auth.ts` is role-vocabulary-only in this phase.

---
*Phase: 01-foundation-access-control*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 16 referenced files (workspaces service/controller/module, e2e test, shared roles/DTO, web route/components/tests) confirmed present on disk; all 3 referenced task commit hashes (`5c72c08`, `1ec715d`, `e81b8f0`) confirmed present in `git log`.
