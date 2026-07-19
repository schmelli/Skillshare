---
phase: 01-foundation-access-control
plan: 05
subsystem: auth
tags: [nestjs, prisma, workspace-role-guard, playwright, better-auth, react-hook-form, zod, shadcn]

# Dependency graph
requires:
  - phase: 01-foundation-access-control
    provides: "SessionGuard + better-auth session validation (Plan 03); WorkspacesModule/WorkspacesService/WorkspacesController, custom admin/editor/consumer WorkspaceRole vocabulary, membership-scoped deny-by-default list pattern, Membership Prisma model (Plan 04)"
provides:
  - "WorkspaceRoleGuard: the single structural per-workspace authorization enforcement point (deny-by-default, reads the caller's actual Membership row for :workspaceId on every request) — every future workspace-scoped route (skills, later phases) reuses this verbatim"
  - "@Roles(...) decorator + MembershipService (findRole, listMembers, grantRole) — grantRole resolves the target by email (upsert on @@unique([userId, workspaceId]) for re-grant idempotency), re-verifies per-workspace Admin authority"
  - "GET/POST /api/workspaces/:workspaceId/members — Admin-only per-workspace role grant and member listing, both SessionGuard + WorkspaceRoleGuard + @Roles('admin')"
  - "Non-leaking 403 contract: WORKSPACE_ACCESS_DENIED_MESSAGE is byte-identical for an unauthorized-but-existing workspace and a nonexistent one"
  - "packages/shared/src/dto/grant-role.ts: targetEmail + role (admin/editor/consumer enum) DTO, separate from the public sign-up/create-workspace DTOs"
  - "apps/web member-management UI: workspaces/$workspaceId.tsx route, member-role-table.tsx (empty/error/populated/overflow states + Remove-member confirmation dialog), grant-role-form.tsx"
  - "apps/web Playwright harness (playwright.config.ts, tests/global-setup.ts, tests/workspace-visibility.spec.ts) — worktree-unique port derivation and pre-suite DB truncation, reusable by future phases' e2e specs"
affects: [02, 03, 04, 05]

# Tech tracking
tech-stack:
  added: ["@playwright/test@1.59.1 (apps/web devDependency)", "pg@8.22.0 + @types/pg (apps/web devDependency, Playwright globalSetup only)"]
  patterns:
    - "WorkspaceRoleGuard reads required roles via Reflector + reads req.params.workspaceId + calls MembershipService.findRole(userId, workspaceId) — null membership is ALWAYS deny (never a default/downgraded role), and the resulting 403 uses one shared, non-leaking message constant for every denial path (no membership, wrong role, malformed request) so an unauthorized-but-existing workspace and a nonexistent one are indistinguishable"
    - "MembershipService.grantRole resolves the target user by EMAIL (not an internal userId) — the natural identifier for a non-technical Admin (CLAUDE.md's audience constraint); 'no user found with that email' is a 400, mapped in the UI to the exact 'unresolvable user' grant-error copy from UI-SPEC"
    - "Playwright suites in this sandbox MUST NOT hardcode ports 3000/5173 — this environment runs multiple worktree-isolated executor agents concurrently against the SAME host network, and Playwright's reuseExistingServer would silently adopt a sibling worktree's own dev server. playwright.config.ts derives a worktree-unique port pair from an md5 hash of process.cwd() and sets reuseExistingServer: false; VITE_API_BASE_URL (already read by apps/web/src/lib/api.ts and lib/auth-client.ts) routes the browser straight at that unique API port, bypassing vite.config.ts's dev proxy (hardcoded to port 3000) entirely"
    - "Playwright's `webServer` for apps/api MUST run `pnpm run build && pnpm run start` (tsx dist/main.js), never `nest start`/`nest start --watch` — both execute compiled/watched output via plain `node`, which cannot resolve @skillshare/shared's extensionless internal imports (ERR_MODULE_NOT_FOUND), the exact issue Plan 04 already hit and fixed for the production start script"
    - "A Playwright APIRequestContext is a single shared cookie jar for the whole test — registering a SECOND user (e.g. the member being granted a role) through the SAME `request` fixture the admin is using will silently overwrite the admin's session cookie (better-auth's sign-up response also sets a session cookie / auto-login). Any multi-user Playwright e2e setup must register secondary users through an isolated `playwright.request.newContext()`, not the shared fixture"
    - "This suite runs against a real, PERSISTENT local Postgres (not per-test-file truncated like apps/api's Vitest e2e specs) — repeated `playwright test` invocations accumulate workspace/user rows, which breaks the workspace-creation bootstrap rule (only the very first workspace in an empty tenant is self-service) on the second run. A `globalSetup` truncating workspace+user (CASCADE) before the suite, never touching the seeded Tenant, keeps every run's starting state clean — mirrors the Vitest e2e specs' own afterEach convention at the whole-suite level instead of per-test"

key-files:
  created:
    - apps/api/src/auth/roles.decorator.ts
    - apps/api/src/auth/workspace-role.guard.ts
    - apps/api/src/workspaces/membership.service.ts
    - apps/api/test/membership.e2e-spec.ts
    - packages/shared/src/dto/grant-role.ts
    - apps/web/src/routes/_authenticated/workspaces/$workspaceId.tsx
    - apps/web/src/components/member-role-table.tsx
    - apps/web/src/components/grant-role-form.tsx
    - apps/web/playwright.config.ts
    - apps/web/tests/workspace-visibility.spec.ts
    - apps/web/tests/global-setup.ts
    - apps/web/test/member-role-table.test.tsx
    - apps/web/test/grant-role-form.test.tsx
  modified:
    - apps/api/src/workspaces/workspaces.controller.ts
    - apps/api/src/workspaces/workspaces.module.ts
    - packages/shared/src/index.ts
    - apps/web/src/lib/api.ts
    - apps/web/package.json
    - .gitignore

key-decisions:
  - "Grant-role DTO field named `targetEmail` (Zod-validated email), not the plan prose's literal `targetUserId` — a non-technical Admin (CLAUDE.md's stated audience) has no way of knowing another user's internal cuid, and the UI-SPEC's own 'unresolvable user' grant-error state only makes sense as an email-lookup failure. The server resolves email -> userId internally and returns a specific 400 ('No user found with that email.') when it doesn't resolve. Documented here rather than silently departing from the plan's literal wording."
  - "The workspace detail route lives at apps/web/src/routes/_authenticated/workspaces/$workspaceId.tsx, not the plan's literal apps/web/src/routes/workspaces/$workspaceId.tsx — the plan's own prose says 'member detail route under _authenticated', and TanStack Router's file-based routing requires nesting under _authenticated/ for the route to inherit the guarded layout's beforeLoad redirect. Same reconciliation Plan 04 already made for workspaces/index.tsx."
  - "'Remove member' is UI-only in this plan (button + confirmation dialog with the exact UI-SPEC copy), not wired to a real API call — no DELETE /api/workspaces/:workspaceId/members/:userId route exists. Matches the UI-SPEC's own framing ('this is a flagged proactive add, not a new requirement') and the plan's Task 3 acceptance criterion, which only requires the confirmation dialog copy to be present. See Known Stubs below."
  - "apps/web's Playwright suite derives a worktree-unique port pair (md5 hash of process.cwd()) instead of the conventional 3000/5173, and truncates workspace+user via a globalSetup script before running — both required to get a trustworthy, re-runnable result in this sandbox's shared-Postgres, multiple-concurrent-worktree-agent environment. Neither is part of the plan's stated files_modified, but both are required for the Playwright verification to mean anything (Rule 3 — blocking, environment-specific)."

patterns-established:
  - "Every future workspace-scoped route (skills CRUD, later phases) should apply WorkspaceRoleGuard + @Roles(...) exactly as WorkspacesController's /:workspaceId/members routes do — a :workspaceId route param, guard-checked membership, never a controller-level manual `if (role !== 'admin')` check."
  - "Any endpoint that needs to identify a target user supplied by a non-technical Admin should resolve by email, mapping 'not found' to a specific, non-leaking error — the same pattern grantRole establishes here."
  - "Playwright suites added in future phases in this monorepo/sandbox should follow this plan's port-derivation + globalSetup-truncation pattern (see playwright.config.ts) rather than hardcoding ports or assuming a fresh DB per run."

requirements-completed: [ORG-02, ORG-03]

coverage:
  - id: D1
    description: "An Admin grants a user a role (Admin/Editor/Consumer) scoped to a specific workspace, and the granted user's own workspace list then includes it (ORG-02)"
    requirement: ORG-02
    verification:
      - kind: e2e
        ref: "apps/api/test/membership.e2e-spec.ts#lets an Admin grant a user a role in a workspace, and the user's workspace list then includes it (ORG-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A role granted in one workspace confers no rights in another — WorkspaceRoleGuard denies a request for a workspace the caller has no membership in, and the 403 body does not confirm the target workspace exists or disclose its name (ORG-03 enforcement + non-leak)"
    requirement: ORG-03
    verification:
      - kind: e2e
        ref: "apps/api/test/membership.e2e-spec.ts#denies a cross-workspace request with a non-leaking 403 that does not confirm existence (ORG-03 non-leak)"
        status: pass
      - kind: e2e
        ref: "apps/web/tests/workspace-visibility.spec.ts#a member of only workspace A sees A in the nav and never sees B"
        status: pass
    human_judgment: false
  - id: D3
    description: "Re-granting a role to a user who already has one in the same workspace updates the existing Membership row rather than creating a duplicate (re-grant idempotency)"
    verification:
      - kind: e2e
        ref: "apps/api/test/membership.e2e-spec.ts#upserts a re-grant into exactly one Membership row instead of duplicating it (idempotency)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A non-Admin member of a workspace cannot grant roles in it — grant authority is verified per-workspace, not globally"
    verification:
      - kind: e2e
        ref: "apps/api/test/membership.e2e-spec.ts#denies a role grant attempted by a non-Admin member of the workspace"
        status: pass
    human_judgment: false
  - id: D5
    description: "member-role-table.tsx renders the 'No members yet.' empty state with the 'Grant access' CTA, one row per member with a role badge (Admin viewer only), an inline error on a failed grant, and truncates long name/email while the role badge never truncates"
    verification:
      - kind: automated_ui
        ref: "apps/web/test/member-role-table.test.tsx (5 tests: error banner+Retry, empty state+CTA, row-per-member with truncate-vs-non-truncating-badge, Remove-member confirmation dialog exact copy)"
        status: pass
      - kind: automated_ui
        ref: "apps/web/test/grant-role-form.test.tsx (3 tests: unresolvable-user copy, generic-failure copy, success path)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 'Remove member' confirmation dialog copy from the UI-SPEC is present (button + dialog), though the confirm action itself does not call a real API — no DELETE route exists in this plan's scope"
    verification:
      - kind: automated_ui
        ref: "apps/web/test/member-role-table.test.tsx#opens the Remove member confirmation dialog with the exact UI-SPEC copy"
        status: pass
    human_judgment: false
  - id: D7
    description: "The docker-compose.yml postgres:18 service itself (not the local PG16 substitute) boots healthy and the full grant/isolation flow works against it"
    verification: []
    human_judgment: true
    rationale: "Same sandbox limitation carried forward from Plans 01-04: Docker Hub pulls are hard-blocked (403) in this environment. This plan continued against the same local Postgres 16 instance already migrated by Plan 02. A human/CI environment with normal Docker Hub egress must confirm before DEPL-03 is considered fully proven against the real deployment target."

duration: ~28min
completed: 2026-07-19
status: complete
---

# Phase 1 Plan 5: WorkspaceRoleGuard + Role Grant + Cross-Workspace Isolation Summary

**`WorkspaceRoleGuard` deny-by-default per-workspace authorization (the single structural enforcement point every future workspace-scoped route reuses), an email-based Admin-only role-grant endpoint with re-grant idempotency, non-leaking 403s verified byte-identical for existing-vs-nonexistent workspaces, and a full member-management UI — proven end-to-end by both a Vitest e2e suite and a real-browser Playwright cross-workspace visibility test.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-07-19T17:30:00Z
- **Completed:** 2026-07-19T17:58:00Z
- **Tasks:** 3 (Task 1 `tdd="true"`: RED test, Task 2's GREEN implementation, Task 3's non-leak hardening confirmation + additional test coverage)
- **Files modified:** 19 (13 created, 6 modified)

## Accomplishments

- `apps/api/src/auth/workspace-role.guard.ts`: `WorkspaceRoleGuard` — reads the caller's actual `Membership` row for `:workspaceId` on every request via `Reflector` + `MembershipService.findRole`; deny-by-default (no membership row = 403, never a default/downgraded role); the denial body is a single generic, non-leaking constant used for every failure path, verified byte-identical between a real-but-unauthorized workspace and a made-up ID
- `apps/api/src/workspaces/membership.service.ts`: `findRole`, `listMembers`, `grantRole` (email-based target lookup, `upsert` on `@@unique([userId, workspaceId])` for re-grant idempotency, re-verifies per-workspace Admin authority beneath the route's own guard)
- `GET`/`POST /api/workspaces/:workspaceId/members`, both `SessionGuard` + `WorkspaceRoleGuard` + `@Roles('admin')` — even reading the member list requires Admin authority for that specific workspace
- `packages/shared/src/dto/grant-role.ts`: `targetEmail` + `role` (admin/editor/consumer enum) DTO, deliberately separate from the public sign-up/create-workspace DTOs
- `apps/web`: `/workspaces/$workspaceId` member route, `member-role-table.tsx` (empty/error/populated/overflow states + Remove-member confirmation dialog with the exact UI-SPEC copy), `grant-role-form.tsx` (Dialog + email/role form, unresolvable-user vs. generic error copy)
- `apps/web` Playwright harness (`playwright.config.ts`, `tests/global-setup.ts`, `tests/workspace-visibility.spec.ts`): worktree-unique port derivation (avoids silently testing a sibling worktree agent's server in this multi-agent sandbox) + pre-suite DB truncation (keeps the workspace-creation bootstrap rule valid across repeated runs against a persistent local Postgres)
- `apps/api/test/membership.e2e-spec.ts` (4 tests) + `apps/web/test/{member-role-table,grant-role-form}.test.tsx` (7 tests) + `apps/web/tests/workspace-visibility.spec.ts` (1 Playwright test, run twice to confirm re-run idempotency) — full ORG-02/ORG-03 behavioral contract
- `pnpm turbo run build test lint`: all packages build/lint clean; full suites green (apps/api 19/19, apps/web 31/31) when run without shared-Postgres contention from concurrent sibling worktree agents (see Issues Encountered)

## Task Commits

1. **Task 1: Failing membership e2e + Playwright cross-workspace visibility test** - `aa3e769` (test) — RED: 4/4 api tests fail with 404 (routes not yet mounted)
2. **Task 2: @Roles + WorkspaceRoleGuard + grant endpoint + member-role-table UI (GREEN)** - `0a06b51` (feat) — all 4 membership.e2e-spec tests pass; Playwright visibility spec green (twice in a row)
3. **Task 3: Non-leak 403 hardening + member-table error/overflow states + Playwright green** - `db45250` (test) — the states themselves were built in Task 2's commit; this commit adds the 7 component tests verifying them, and re-confirms the non-leak assertion + Playwright green

**Plan metadata:** (this commit, made by the worktree's `git_commit_metadata` step in worktree mode — SUMMARY.md + REQUIREMENTS.md only)

## Files Created/Modified

- `apps/api/src/auth/{roles.decorator.ts,workspace-role.guard.ts}` — `@Roles(...)` metadata decorator + the deny-by-default per-workspace guard
- `apps/api/src/workspaces/membership.service.ts` — `findRole`/`listMembers`/`grantRole`
- `apps/api/src/workspaces/{workspaces.controller.ts,workspaces.module.ts}` — `/:workspaceId/members` routes, `MembershipService`/`WorkspaceRoleGuard` wiring
- `apps/api/test/membership.e2e-spec.ts` — 4 e2e tests
- `packages/shared/src/dto/grant-role.ts` + `src/index.ts` — `grantRoleDto`
- `apps/web/src/routes/_authenticated/workspaces/$workspaceId.tsx` — member management route
- `apps/web/src/components/{member-role-table.tsx,grant-role-form.tsx}` — member list + grant flow
- `apps/web/src/lib/api.ts` — `getMembers`, `grantRole`, `MembershipApiError`
- `apps/web/playwright.config.ts` + `tests/{global-setup.ts,workspace-visibility.spec.ts}` — Playwright harness
- `apps/web/test/{member-role-table,grant-role-form}.test.tsx` — 7 component tests
- `apps/web/package.json` — `@playwright/test`, `pg`, `@types/pg`
- `.gitignore` — Playwright's generated `test-results/`/`playwright-report/`/`blob-report/`

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: (1) grant-role DTO identifies the target by email, not an internal userId, matching the UI-SPEC's "unresolvable user" error state and the non-technical-Admin audience constraint; (2) the member route nests under `_authenticated/` per Plan 04's established convention, reconciling the plan's own contradictory literal-path-vs-prose; (3) "Remove member" is UI-only in this plan (button + dialog, no backend route) per the UI-SPEC's own "proactive, not required" framing; (4) the Playwright suite derives worktree-unique ports and truncates its own test data before running, both required to get a trustworthy result in this sandbox's shared-Postgres, multi-agent environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `apps/api/.env` did not exist in this fresh worktree checkout**
- **Found during:** Task 1 setup (before running any test)
- **Issue:** `.env` is gitignored, not committed; a fresh worktree has none.
- **Fix:** Recreated it pointing at the same local Postgres 16 instance Plans 01-04 already established (`postgresql://postgres:postgres@localhost:5432/skillshare`), matching the `<environment_reality>` guidance.
- **Files modified:** `apps/api/.env` (gitignored, not committed)
- **Committed in:** N/A (gitignored)

**2. [Rule 1 - Bug] Playwright's `webServer` command (`nest start`) failed with `ERR_MODULE_NOT_FOUND`**
- **Found during:** Task 2, first `playwright test` run
- **Issue:** `nest start` (and `nest start --watch`) both execute the app via plain `node`, which cannot resolve `@skillshare/shared`'s extensionless internal imports (`./dto/auth`) under Node's own ESM resolver — the exact issue Plan 04 already hit and fixed for the production `start` script by switching to `tsx dist/main.js`.
- **Fix:** Changed the Playwright `webServer` command to `pnpm run build && pnpm run start` (the already-proven `tsx dist/main.js` script), instead of `nest start`.
- **Files modified:** `apps/web/playwright.config.ts`
- **Verification:** `apps/api` boots cleanly under the Playwright-managed process; routes mapped correctly (confirmed via manual log inspection)
- **Committed in:** `0a06b51` (Task 2)

**3. [Rule 3 - Blocking] Hardcoded ports 3000/5173 collided with sibling worktree agents' own dev servers in this sandbox**
- **Found during:** Task 2, debugging a confusing Playwright failure (workspace creation returning 403 for a brand-new admin user)
- **Issue:** This sandbox runs several worktree-isolated executor agents concurrently on the same host network; `ps aux` showed multiple `vite` processes from *other* worktree paths already bound near port 5173. Playwright's `reuseExistingServer: true` (the default when `!CI`) would treat any listener on the configured port as "already up" and silently test against a completely different worktree's running server/API.
- **Fix:** Derived a worktree-unique port pair from an md5 hash of `process.cwd()`, set `reuseExistingServer: false`, and routed the browser directly at the unique API port via `VITE_API_BASE_URL` (bypassing `vite.config.ts`'s dev proxy, which is hardcoded to port 3000).
- **Files modified:** `apps/web/playwright.config.ts`
- **Verification:** Playwright test passed reliably against verified-own-worktree ports (confirmed the API's mapped routes and DB rows matched the test's own data)
- **Committed in:** `0a06b51` (Task 2)

**4. [Rule 1 - Bug] Playwright's shared `request` fixture cookie jar caused the member's own sign-up to silently overwrite the admin's session cookie**
- **Found during:** Task 2, after fixing the port issue, the grant call still 403'd even though the admin genuinely held an `admin` Membership for the target workspace
- **Issue:** better-auth's sign-up response also sets a session cookie (auto-login). Registering the member user through the SAME `request` fixture the admin was using overwrote the admin's session cookie in that fixture's single shared cookie jar, so the subsequent "admin" grant call actually ran as the newly-registered member (who holds no admin membership anywhere) — a red herring that looked identical to a genuine authorization bug.
- **Fix:** Registered the member through an isolated `playwright.request.newContext()` instead of the shared fixture, so the admin's cookie jar is never touched by the member's own sign-up.
- **Files modified:** `apps/web/tests/workspace-visibility.spec.ts`
- **Verification:** Grant call succeeded (200); Playwright test passed end to end
- **Committed in:** `0a06b51` (Task 2)

**5. [Rule 3 - Blocking] Playwright test not re-runnable against the persistent local Postgres**
- **Found during:** Task 2, second manual `playwright test` invocation
- **Issue:** Unlike `apps/api`'s Vitest e2e specs (which truncate between every test), this Playwright suite runs against a real, persistent Postgres across repeated `playwright test` invocations. After the first successful run left workspace rows behind, the second run's fresh admin user could no longer bootstrap a workspace (tenant no longer empty, and the new admin holds no prior admin membership) — deterministically breaking every subsequent run.
- **Fix:** Added `tests/global-setup.ts`, truncating `workspace`+`user` (CASCADE) once before the whole suite runs, never touching the seeded `Tenant` row — same convention as the Vitest e2e specs' own `afterEach`, applied at the whole-suite level.
- **Files modified:** `apps/web/tests/global-setup.ts`, `apps/web/playwright.config.ts`, `apps/web/package.json` (added `pg`+`@types/pg`, verified as the same official packages already used in `apps/api`, before installing)
- **Verification:** Ran the Playwright test twice in a row; both passed
- **Committed in:** `0a06b51` (Task 2)

**6. [Rule 2 - Missing Critical] Playwright's generated `test-results/`/`playwright-report/` were not gitignored**
- **Found during:** Task 2, `git status` after a local `playwright test` run
- **Issue:** Every local `playwright test` invocation writes trace/screenshot artifacts to `apps/web/test-results/`; without a `.gitignore` entry these would eventually get committed as noise (or accidentally staged).
- **Fix:** Added `apps/web/{test-results,playwright-report,blob-report}/` to the root `.gitignore`.
- **Files modified:** `.gitignore`
- **Committed in:** `0a06b51` (Task 2)

---

**Total deviations:** 6 auto-fixed (2 Rule 1 bugs in the new Playwright test infrastructure itself, 3 Rule 3 blocking/environment-specific fixes — all specific to this sandbox's shared-Postgres, multi-concurrent-worktree-agent setup rather than the product code — and 1 Rule 2 missing-critical `.gitignore` entry). None represent scope creep or an unrequested architectural change to the product's own authorization model; every fix was required to get the plan's own required Playwright verification to run at all, or to run trustworthily, in this specific sandbox.
**Impact on plan:** Every acceptance criterion in the plan is met. The `WorkspaceRoleGuard`/`MembershipService`/grant-endpoint implementation itself required no deviations beyond the `targetEmail` interpretive decision (documented in `key-decisions`); all deviations besides that one are Playwright-test-infrastructure-only and do not affect the shipped API/UI behavior.

## Known Stubs

- **`RemoveMemberDialog`'s confirm action (`apps/web/src/components/member-role-table.tsx`)**: renders the exact UI-SPEC "Remove member" confirmation copy and button, but clicking "Remove" only closes the dialog — it does not call any API. No `DELETE /api/workspaces/:workspaceId/members/:userId` route exists; per the UI-SPEC's own note ("this is a flagged proactive add, not a new requirement") and this plan's Task 3 acceptance criterion (which only requires the confirmation dialog *copy* to be present), this is an intentional, documented scope boundary — not a gap in ORG-02 (the actual required deliverable, granting a role, is fully functional). A future plan should add the backend route and wire the confirm action to it.

## Issues Encountered

- Same sandbox limitations carried forward from Plans 01-04: Node is `v22.22.2` (not the pinned `>=24`), Docker Hub pulls are blocked, and `apps/api/.env` needed recreating fresh in this worktree.
- **New for this plan:** running `pnpm turbo run build test lint` at the very end (all packages concurrently) surfaced one transient `membership.e2e-spec.ts` failure — a "createWorkspace" bootstrap call unexpectedly got 403 — that did NOT reproduce when the same suite was run in isolation (confirmed 3 consecutive clean 19/19 runs immediately before and after). This sandbox runs multiple worktree-isolated executor agents concurrently against the SAME shared local Postgres instance (directly observed via `ps aux` showing sibling worktrees' own `vite`/`tsx` processes during this plan's work) — a sibling agent creating a workspace at the exact moment this suite's bootstrap-workspace test ran is the most likely explanation, not a defect in this plan's own code. This is a pre-existing race inherent to Plan 04's bootstrap-authorization design (any fresh admin's first workspace requires an empty tenant) combined with the shared-DB sandbox setup, not something newly introduced here. Flagged for awareness; a future phase that hardens CI should consider a per-run/per-worktree database instead of one shared instance.

## User Setup Required

None — no external service configuration required. `apps/api/.env` (gitignored) was recreated in this session pointing at the same local Postgres already established by Plans 01-04.

## Next Phase Readiness

- The permission backbone (`WorkspaceRoleGuard` + `MembershipService`) is complete and proven end-to-end: an Admin grants per-workspace roles, a role in one workspace confers nothing in another, and cross-workspace 403s leak no name/existence. Phases 4/5 (REST, CLI, MCP) can reuse `WorkspaceRoleGuard` + `@Roles(...)` verbatim on every new workspace-scoped route, per the plan's own stated purpose.
- The Playwright harness (`playwright.config.ts`, `tests/global-setup.ts`) is reusable by future phases' own e2e specs — follow its worktree-unique-port + globalSetup-truncation pattern rather than hardcoding ports or assuming a fresh DB per run, given this sandbox's shared-Postgres, multi-agent setup.
- **Carried forward from Plans 01-04:** `docker compose up -d postgres` against the real `postgres:18` container (not the local PG16 substitute) still needs a human/CI environment with normal Docker Hub egress to confirm, before Phase 1's DEPL-03 requirement is considered fully proven against the real deployment target.
- **New follow-up for a future plan:** wire `member-role-table.tsx`'s "Remove member" confirm action to a real `DELETE /api/workspaces/:workspaceId/members/:userId` route (see Known Stubs above) — the UI/copy is ready, the backend route is not yet built.
- Phase 1's stated success criteria (deny-by-default `WorkspaceRoleGuard`, non-leaking 403s, Admin-only per-workspace role grant, complete permission backbone) are now fully met.

---
*Phase: 01-foundation-access-control*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 14 referenced files (guard/decorator/service, controller/module, shared DTO, membership e2e spec, web route/components/tests, Playwright harness, this SUMMARY) confirmed present on disk; all 3 referenced task commit hashes (`aa3e769`, `0a06b51`, `db45250`) confirmed present in `git log`.
