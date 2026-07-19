# Walking Skeleton — Skillshare

**Phase:** 1
**Generated:** 2026-07-19

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user can register with email + password, log in, and land on a dashboard that reads
live data from PostgreSQL through the NestJS/Fastify API — proving the React SPA → REST API
→ better-auth → Prisma 7 → Postgres 18 stack works end to end, with the organization-scoped
data model (`Tenant → Workspace → Membership`) present from the first migration.

The thinnest end-to-end proof (Plan 01–02) is a health landing page that renders a real
`prisma.tenant.count()` read; Plan 03 replaces it with the real register/login feature that
writes a user row and issues a session cookie.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo (`apps/api`, `apps/web`, `packages/shared`) | Locked stack (CLAUDE.md). One TypeScript language, shared Zod/types package across API + dashboard. `apps/cli`, `apps/mcp-server`, `packages/skill-parser` deferred to Phases 2/5 — Turborepo globs pick them up later, no empty stubs now. |
| Backend framework | NestJS 11 + Fastify adapter (`@nestjs/platform-fastify`) | Locked stack. Guards give a single structural enforcement point for the hard security constraint ("unauthorized agents must never receive skill content"). Fastify bootstrap uses `bodyParser: false` so better-auth owns raw request bodies on `/api/auth/*`. |
| Data layer | Prisma 7.8 (`prisma-client` generator + explicit `output`, `@prisma/adapter-pg`, `prisma.config.ts`) against Postgres 18 | Locked stack. Prisma 7 dropped the Rust engine — driver adapter is mandatory, config moves to `prisma.config.ts`. Migrations run unattended via `prisma migrate deploy` in the Docker entrypoint (serves the non-technical self-hoster). |
| Auth | better-auth 1.6.23, `emailAndPassword` + `organization` plugin (aliased 1:1 to "Workspace") + `createAccessControl` custom roles (admin/editor/consumer) | Locked stack. Mounted via the framework-agnostic `auth.handler` route, NOT the `[SUS]` `@thallesp/nestjs-better-auth` community Fastify adapter (RESEARCH Package Legitimacy Audit). Password hashing/sessions delegated entirely to better-auth (never hand-rolled). |
| Identity model | `Tenant → Workspace → Membership(role)` — org-scoped from day one; v1 self-hosted seeds exactly one `Tenant` | Satisfies DEPL-03 ("no schema redesign for later multi-tenant mode"). `Workspace` = better-auth `organization` row extended/shadowed with a NON-NULL `tenantId` FK. |
| Frontend | React 19 + Vite 7 SPA, TanStack Router + TanStack Query, shadcn/ui (new-york / neutral) + Tailwind v4 | Locked stack + UI-SPEC. No Next.js (CLAUDE.md "What NOT to Use"). Served as static files by the API in prod; cross-origin (`5173→3000`) in dev via `trustedOrigins` + CORS. |
| Deployment target | Docker Compose (`api` + `postgres` only) for dev; `pnpm dev` for fast local iteration | Locked constraint: `docker compose up` must work out of the box, no external services. pg-boss/Redis/S3 explicitly NOT introduced in Phase 1. |
| Directory layout | Feature modules under `apps/api/src/*` (`auth/`, `workspaces/`, `health/`); file-based routes under `apps/web/src/routes/*` | NestJS module-per-feature; TanStack file-based routing. |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm/Turborepo, NestJS+Fastify, Vite+React, Vitest, ESLint/Prettier) — Plan 01
- [x] Routing — real `/api/health` REST route + TanStack `__root`/index dashboard route — Plan 01/02
- [x] Database — real write (seed one `Tenant` row) AND real read (`prisma.tenant.count()`, then user register/login) — Plan 02/03
- [x] UI — index route fetches `/api/health` (Plan 02); register/login form wired to `/api/auth/*` (Plan 03)
- [x] Deployment — `docker compose up` (postgres) + documented `pnpm dev` full-stack run; `prisma migrate dev --name init` applies schema — Plan 01/02

## Out of Scope (Deferred to Later Slices)

> Explicit — prevents future phases re-litigating Phase 1's minimalism.

- Skill authoring / SKILL.md editor, `gray-matter`, MDXEditor (Phase 2)
- Draft→review→publish governance, version history, diff/rollback (Phase 3)
- Personal access tokens / `@better-auth/api-key`, REST list/pull distribution (Phase 4)
- `skillshare` CLI, MCP server, `@modelcontextprotocol/sdk`, `commander` (Phase 5)
- Audit log viewer, analytics, compliance export (Phase 3/6)
- Full `docker compose up` production packaging + tested upgrade path (Phase 7)
- Postgres Row-Level Security (defense-in-depth; v2/hardening per CLAUDE.md)
- SSO/OIDC, multi-tenant SaaS mode (v2 — but the `Tenant` table makes it a config change, not a migration)
- `remove/revoke member` beyond the proactive confirmation UI (flagged in UI-SPEC; grant is the ORG-02 requirement)
- Autosave/draft-recovery for the create-workspace form (UI-SPEC unresolved; explicitly out of scope)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: A non-technical author creates and edits a skill in the dashboard markdown editor (no git/YAML).
- Phase 3: A draft moves through server-enforced four-eyes review to an immutable published version.
- Phase 4: An authorized agent lists and pulls published skills over REST using a scoped token.
- Phase 5: The `skillshare` CLI syncs permitted skills to disk; the MCP server serves them at runtime.
- Phase 6: An admin views/filters the audit log, exports compliance reports, sees staleness analytics.
- Phase 7: One-command `docker compose up` with a tested, data-preserving upgrade path.
