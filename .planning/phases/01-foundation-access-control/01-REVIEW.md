---
phase: 01-foundation-access-control
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 61
files_reviewed_list:
  - apps/api/package.json
  - apps/api/prisma.config.ts
  - apps/api/prisma/migrations/20260719162713_init/migration.sql
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/seed.ts
  - apps/api/src/app.module.ts
  - apps/api/src/auth/auth.controller.ts
  - apps/api/src/auth/auth.module.ts
  - apps/api/src/auth/auth.ts
  - apps/api/src/auth/roles.decorator.ts
  - apps/api/src/auth/session.guard.ts
  - apps/api/src/auth/workspace-role.guard.ts
  - apps/api/src/health/health.controller.ts
  - apps/api/src/health/health.module.ts
  - apps/api/src/main.ts
  - apps/api/src/prisma/prisma.module.ts
  - apps/api/src/prisma/prisma.service.ts
  - apps/api/src/workspaces/membership.service.ts
  - apps/api/src/workspaces/workspaces.controller.ts
  - apps/api/src/workspaces/workspaces.module.ts
  - apps/api/src/workspaces/workspaces.service.ts
  - apps/api/test/auth.e2e-spec.ts
  - apps/api/test/health.e2e-spec.ts
  - apps/api/test/membership.e2e-spec.ts
  - apps/api/test/schema-tenant-scoping.spec.ts
  - apps/api/test/setup.ts
  - apps/api/test/workspaces.e2e-spec.ts
  - apps/api/vitest.config.ts
  - apps/web/components.json
  - apps/web/package.json
  - apps/web/playwright.config.ts
  - apps/web/src/components/app-nav.tsx
  - apps/web/src/components/create-workspace-dialog.tsx
  - apps/web/src/components/grant-role-form.tsx
  - apps/web/src/components/member-role-table.tsx
  - apps/web/src/components/ui/badge.tsx
  - apps/web/src/components/ui/button.tsx
  - apps/web/src/components/ui/card.tsx
  - apps/web/src/components/ui/dialog.tsx
  - apps/web/src/components/ui/form.tsx
  - apps/web/src/components/ui/input.tsx
  - apps/web/src/components/ui/label.tsx
  - apps/web/src/components/ui/skeleton.tsx
  - apps/web/src/components/workspace-list.tsx
  - apps/web/src/index.css
  - apps/web/src/lib/api.ts
  - apps/web/src/lib/auth-client.ts
  - apps/web/src/routes/__root.tsx
  - apps/web/src/routes/_authenticated.tsx
  - apps/web/src/routes/_authenticated/index.tsx
  - apps/web/src/routes/_authenticated/workspaces/$workspaceId.tsx
  - apps/web/src/routes/_authenticated/workspaces/index.tsx
  - apps/web/src/routes/login.tsx
  - apps/web/src/routes/register.tsx
  - apps/web/test/app-nav.test.tsx
  - apps/web/test/create-workspace-dialog.test.tsx
  - apps/web/test/grant-role-form.test.tsx
  - apps/web/test/login.test.tsx
  - apps/web/test/member-role-table.test.tsx
  - apps/web/test/register.test.tsx
  - apps/web/test/setup.ts
  - apps/web/test/workspace-list.test.tsx
  - apps/web/tests/global-setup.ts
  - apps/web/tests/workspace-visibility.spec.ts
  - apps/web/tsconfig.json
  - apps/web/vite.config.ts
  - apps/web/vitest.config.ts
  - packages/shared/package.json
  - packages/shared/src/dto/auth.ts
  - packages/shared/src/dto/grant-role.ts
  - packages/shared/src/dto/workspace.ts
  - packages/shared/src/index.ts
  - packages/shared/src/roles.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-19
**Depth:** standard
**Files Reviewed:** 61 (test files reviewed for reliability only, per scope rules)
**Status:** issues_found

## Summary

This phase implements the foundational Tenant → Workspace → Membership RBAC model on NestJS/Fastify + Prisma 7 + better-auth, plus a React/Vite dashboard consuming it. The core enforcement path is sound: `WorkspaceRoleGuard` correctly denies-by-default on a missing Membership row, returns an identical generic 403 for both "exists but no access" and "doesn't exist" cases (no enumeration leak), `WorkspacesService.listForUser`/`MembershipService.listMembers` always start from the caller's own rows rather than an unfiltered query, and every mutating DTO (`signUpDto`, `createWorkspaceDto`, `grantRoleDto`) is deliberately narrow, with role/tenant/creator fields always server-derived — no mass-assignment path was found. Guard ordering (`SessionGuard` at controller level, `WorkspaceRoleGuard` at route level) is correct per NestJS's guard execution order, so `req.user` is always populated before `WorkspaceRoleGuard` reads it.

No Critical/BLOCKER-severity issues were found — no injection, no auth bypass, no secret leakage, no XSS (React's default escaping is relied upon throughout, no `dangerouslySetInnerHTML`/`eval`/`innerHTML` usage found). The Warning-level findings below are real logic/robustness gaps: an email-casing mismatch between sign-up and the grant-role lookup, no protection against a workspace losing its last Admin, no login/sign-up rate limiting despite the enumeration-hardening the tests otherwise assert, and duplicated header-conversion logic that must be kept in sync by hand. Info-level findings are minor dead code and a superfluous unauthenticated info disclosure.

## Warnings

### WR-01: Email-casing mismatch between sign-up and grant-role lookup can make a real user unfindable ("no user found")

**File:** `packages/shared/src/dto/auth.ts:8-12`, `packages/shared/src/dto/grant-role.ts:12-19`, `apps/api/src/workspaces/membership.service.ts:100-105`
**Issue:** `grantRoleDto.targetEmail` is normalized with `.trim().toLowerCase()` before `MembershipService.grantRole` does `prisma.user.findUnique({ where: { email: targetEmail } })`. `signUpDto.email`, however, is validated with only `z.string().email()` — no `.trim()`/`.toLowerCase()` — and the `User.email` column has a plain (case-sensitive) `@@unique` constraint (see `migration.sql:136`, `CREATE UNIQUE INDEX "user_email_key" ON "user"("email")`). If a user registers as `Jane@Example.com`, an Admin later granting them a role by typing the same address (or the natural lowercase form) will get `grantRole`'s `user-not-found` branch even though the account exists — the two code paths silently disagree on what "the same email" means. This directly undermines the "identify the target by email, the natural identifier for a non-technical Admin" design goal stated in the DTO's own comment.
**Fix:** Normalize consistently at the boundary that actually creates the row. Either add the same `.trim().toLowerCase()` transform to `signUpDto.email` (and confirm better-auth's own internal sign-up path applies it before insert, since better-auth does not lowercase email by default), or add a case-insensitive Postgres citext/`LOWER(email)` unique index and use `findFirst({ where: { email: { equals: targetEmail, mode: "insensitive" } } })` in `grantRole`. Pick one canonical normalization point and apply it on both the write path (sign-up) and the read path (grant lookup).

### WR-02: No protection against a workspace losing its last Admin

**File:** `apps/api/src/workspaces/membership.service.ts:89-116`
**Issue:** `grantRole` only checks that the *acting* user currently holds `admin` in the workspace; it never checks whether the *target* of the update is the acting user themselves, nor whether they are the workspace's only Admin. An Admin can call `POST /api/workspaces/:id/members` with their own email and a lower role (or grant themselves out) and — since the upsert unconditionally overwrites — the workspace can end up with zero Admins. At that point no one (short of direct DB access) can ever grant another Admin in that workspace again, because every enforcement path (`WorkspaceRoleGuard` + `@Roles('admin')`) requires an existing Admin Membership row to perform the grant. There is no tenant-level super-admin fallback in the current schema.
**Fix:** In `grantRole`, when the role being written is not `admin` and the target is the workspace's last remaining Admin (or when the target equals `actingUserId` and would remove their own Admin status), reject with a clear "cannot remove the last Admin" error, e.g.:
```typescript
if (role !== "admin") {
  const adminCount = await this.prisma.membership.count({
    where: { workspaceId, role: "admin" },
  });
  const targetIsCurrentAdmin =
    (await this.findRole(targetUser.id, workspaceId))?.role === "admin";
  if (targetIsCurrentAdmin && adminCount <= 1) {
    return { ok: false, reason: "last-admin" };
  }
}
```

### WR-03: No rate limiting / brute-force protection on `/api/auth/sign-in/email` or `/api/auth/sign-up/email`

**File:** `apps/api/src/auth/auth.ts:56-75`, `apps/api/src/auth/auth.controller.ts`
**Issue:** `betterAuth({...})` is configured with `emailAndPassword` and the `organization` plugin only — no rate-limit configuration is passed, and none of the plan/research artifacts in this phase (`01-01..05-PLAN.md`, `01-RESEARCH.md`) document a decision to rely on a specific default. The test suite (`auth.e2e-spec.ts`) explicitly asserts login-failure responses are enumeration-safe (ambiguous error copy for wrong-password vs. nonexistent-email), which strongly signals credential-stuffing/enumeration was a stated concern for this phase (ASVS L1 V2.2/V2.4-adjacent controls) — but nothing in the reviewed code bounds the *rate* at which either endpoint can be hit. Without rate limiting, ambiguous error copy only slows down enumeration by making a single guess ambiguous; it does not prevent automated brute-force credential stuffing against `/api/auth/sign-in/email`.
**Fix:** Configure better-auth's built-in rate limiting explicitly (don't rely on an undocumented default), e.g.:
```typescript
export const auth = betterAuth({
  // ...
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});
```
or front the `/api/auth/*` routes with a NestJS throttler guard. Document the chosen limits in the phase's threat-model artifacts so the decision is traceable.

### WR-04: Duplicated `toWebHeaders` implementation must be kept manually in sync

**File:** `apps/api/src/auth/auth.controller.ts:49-60`, `apps/api/src/auth/session.guard.ts:34-45`
**Issue:** The exact same Fastify-headers-to-`Headers` conversion function is copy-pasted verbatim in two files. Both are on the hot path for every authenticated request (`SessionGuard.canActivate` and `AuthController.handleAuth`) and both must handle multi-valued headers (e.g., repeated `Cookie`/`Set-Cookie` semantics) identically for auth to behave consistently. A future edit to one (e.g., to special-case a header) that isn't mirrored to the other silently reintroduces an auth-adjacent inconsistency.
**Fix:** Extract to a single shared helper (e.g. `apps/api/src/auth/web-headers.ts`) and import it from both call sites.

### WR-05: `bootstrap()` in `main.ts` has no top-level error handling

**File:** `apps/api/src/main.ts:8-27`
**Issue:** `bootstrap()` is an async function invoked with no `.catch()` and no `await`. If `NestFactory.create`, `app.listen`, or the Prisma `$connect` inside `PrismaService.onModuleInit` rejects (e.g., DB unreachable at container start — a realistic first-run scenario for the "Docker Compose must work out of the box" self-hosted target audience), the failure surfaces only as an unhandled promise rejection with no application-level logging of *why* startup failed, and the process may exit with a non-obvious code depending on the Node version's unhandled-rejection policy.
**Fix:**
```typescript
bootstrap().catch((error) => {
  console.error("Fatal error during bootstrap:", error);
  process.exit(1);
});
```

## Info

### IN-01: `AuthenticatedUser` type and `isWorkspaceRole` type guard are exported but never used

**File:** `apps/api/src/auth/session.guard.ts:5-7`, `packages/shared/src/roles.ts:10-15`
**Issue:** `AuthenticatedUser` (derived from `auth.api.getSession`'s return type) has no importers anywhere in `apps/api` or `apps/web`. `isWorkspaceRole` is likewise never called — role validation is done via `z.enum(WORKSPACE_ROLES)` in the DTOs instead, and no code narrows an `unknown` value with this guard.
**Fix:** Either wire `AuthenticatedUser` into `RequestWithUser`/`SessionGuard`'s attached `req.user`/`req.session` typing (currently typed as bare `unknown` casts in `session.guard.ts:26-29`, so the guard isn't even using its own exported type), and use `isWorkspaceRole` where role strings cross an `unknown` boundary (e.g., validating `membership.role as WorkspaceRole` in `membership.service.ts:50`/`71` instead of an unchecked cast) — or remove the unused exports.

### IN-02: `GET /api/health` is unauthenticated and returns a real DB-derived count

**File:** `apps/api/src/health/health.controller.ts:10-14`
**Issue:** The endpoint is intentionally public (no `@UseGuards`), which is normal for a liveness/health check, but it also does a real `prisma.tenant.count()` read and returns the number in the response body to any unauthenticated caller. This is not skill content and is low sensitivity, but it is unnecessary information disclosure (confirms the deployment has bootstrapped data) for a check whose only real purpose is "is the process up and can it reach Postgres."
**Fix:** If a real DB round-trip is wanted for the liveness check, keep the query but drop `tenantCount` from the public response body (or return only a boolean `dbReachable: true`), and move the count into an authenticated diagnostics endpoint if it's needed by the dashboard.

### IN-03: `WEB_ORIGIN` fallback (`"http://localhost:5173"`) is duplicated across `main.ts` and `auth.ts`

**File:** `apps/api/src/main.ts:18`, `apps/api/src/auth/auth.ts:64`
**Issue:** Both the Fastify CORS `origin` and better-auth's `trustedOrigins` independently compute `process.env.WEB_ORIGIN ?? "http://localhost:5173"`. They currently happen to agree, but nothing enforces that they stay in sync if one is edited without the other (e.g., a future change to support multiple trusted origins in `auth.ts` without a matching CORS update would produce confusing "CORS blocked but better-auth trusts it" or vice-versa behavior).
**Fix:** Compute `WEB_ORIGIN` once (e.g., in a small shared config module) and import it in both `main.ts` and `auth.ts`.

### IN-04: `apiFetch`'s generic error path discards the response body

**File:** `apps/web/src/lib/api.ts:20-41`
**Issue:** `apiFetch` (used by `getWorkspaces`, `getMembers`, `getHealth`) throws a bare `ApiError` with only `status` and a synthesized message on any non-OK response — the actual server error body (e.g., a validation message) is never read or exposed to callers. This is fine today because none of `apiFetch`'s current call sites need the body, but it's an easy trap for the next endpoint added via this helper (the pattern already had to be special-cased twice, in `WorkspaceApiError`/`MembershipApiError`, by bypassing `apiFetch` entirely and hand-rolling `fetch` calls in `createWorkspace`/`grantRole`).
**Fix:** Give `apiFetch` the same body-capturing behavior as `WorkspaceApiError`/`MembershipApiError` (attach the parsed body to `ApiError`) so future call sites don't need to duplicate the whole fetch call just to get at the error body.

---

_Reviewed: 2026-07-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
