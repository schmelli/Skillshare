# Phase 1: Foundation & Access Control - Research

**Researched:** 2026-07-19
**Domain:** Auth + org-scoped RBAC foundation for a greenfield TypeScript monorepo (NestJS/Fastify + Prisma 7 + Postgres 18 + better-auth + React 19/Vite dashboard)
**Confidence:** MEDIUM (Context7 MCP unavailable this session; all findings are WebSearch-derived and cross-checked against 2+ independent sources per topic, including official docs pages where reachable. No claim in this document has been checked against a live-running instance of better-auth 1.6.23 or Prisma 7.8 — see Assumptions Log.)

## Summary

Phase 1 is a brand-new empty repository (no code exists yet). This phase must stand up the entire monorepo skeleton — pnpm workspaces + Turborepo, a NestJS 11 (Fastify adapter) API, a React 19 + Vite dashboard, and Prisma 7 against Postgres 18 — and deliver one real vertical slice: register/login, create a workspace, grant a per-workspace role, and see only authorized workspaces.

The central design decision is how to map this project's two-level permission model (Organization/tenant → Workspace → per-workspace Admin/Editor/Consumer role) onto better-auth's **organization plugin**, whose native primitive is a single-level Organization with member roles. The best-fit approach (recommended below) is to treat a better-auth "organization" as this project's **Workspace** 1:1 — this gets multi-membership, per-workspace roles, and custom role names for free from a maintained library — and add a thin, better-auth-independent `Tenant` table above it purely to satisfy DEPL-03's "no schema redesign later" requirement. This is a synthesized recommendation, not a documented pattern from better-auth's own docs, and should be treated as the single highest-leverage decision for the planner/discuss-phase to confirm.

The second major risk area is the NestJS+Fastify+better-auth integration itself. The most-referenced community glue package (`@thallesp/nestjs-better-auth`) has Fastify support that multiple sources describe as newer/beta with documented CORS gotchas, and the package itself is about a year old with a single maintainer — it is flagged `[SUS]` in the Package Legitimacy Audit below. The lower-risk path documented by better-auth itself is framework-agnostic: mount `auth.handler` directly as a raw Fastify/Nest route and read sessions server-side via `auth.api.getSession({ headers })` inside a hand-written NestJS guard. This avoids taking a dependency on unproven Fastify glue for the single most security-critical code path in the whole project.

Prisma 7 (released after this project's stack doc was researched, now the pinned version) has three breaking changes that materially affect Phase 1 scaffolding versus older Prisma tutorials found on the web: the `prisma-client` generator (not `prisma-client-js`) with a **required custom output path**, a **mandatory driver adapter** (`@prisma/adapter-pg` for Postgres — the Rust query engine is gone), and datasource `url`/`directUrl` moving out of `schema.prisma` into a new `prisma.config.ts` file. Any scaffolding task must account for this or it will silently follow stale Prisma 6-era instructions.

**Primary recommendation:** Scaffold pnpm+Turborepo monorepo (apps/api, apps/web, packages/shared) → NestJS 11+Fastify API with better-auth mounted via `auth.handler` (not the community Nest-Fastify glue package) + `organizationPlugin` aliased conceptually to "Workspace" with custom Admin/Editor/Consumer roles via `createAccessControl` → Prisma 7 with `@prisma/adapter-pg` and a thin `Tenant` parent table → React 19 + Vite + TanStack Router + TanStack Query + shadcn/ui dashboard → docker-compose.yml running Postgres 18 (+ optionally the API) for local dev.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| AUTH-01 | User can register and log in with email and password | better-auth `emailAndPassword` provider (Standard Stack, Pattern 1/2, Code Examples); framework-agnostic `auth.handler` mount avoids the flagged-SUS Fastify community adapter (Package Legitimacy Audit, Pitfall 2) |
| ORG-01 | Admin can create and manage workspaces | better-auth `organization` plugin aliased 1:1 to Workspace (Pattern 2); Admin-only mutation enforced via `WorkspaceRoleGuard` (Code Examples, Don't Hand-Roll) |
| ORG-02 | Admin can grant users per-workspace roles (Admin/Editor/Consumer) | Custom roles via `createAccessControl`/`ac.newRole()` (Pattern 2); role-grant kept as a separate Admin-only endpoint distinct from self-service DTOs (Pitfall 4, Security Domain) |
| ORG-03 | Users see only the workspaces and skills they are authorized for — in the dashboard and every API | `WorkspaceRoleGuard` deny-by-default enforcement (System Architecture Diagram, Anti-Patterns); `organization.list()` for multi-membership listing (Open Question 1 area, Summary) |
| DEPL-03 | Data model is organization-scoped from day one so a later multi-tenant mode needs no schema redesign | Pattern 3 (`Tenant → Workspace → Membership`); flagged as the single highest-risk synthesized recommendation in this research — see Assumption A2 and Open Question 1 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Registration / login form | Browser / Client | Frontend (Vite SPA) | Pure form UI; no SSR in this stack (Vite SPA, not Next.js per CLAUDE.md) |
| Password hashing, session token issuance | API / Backend | — | Security-critical; must never happen client-side. better-auth core runs inside the NestJS process |
| Session validation on every request | API / Backend | — | Guard-enforced per request; the single point where "unauthorized agents must never receive skill content" is structurally guaranteed |
| Workspace CRUD | API / Backend | Database | Business logic + persistence; dashboard only calls the API, never writes DB directly |
| Per-workspace role assignment | API / Backend | Database | Must be server-enforced (Admin-only mutation) — never trust a client-submitted role field |
| Workspace/role-scoped data filtering ("see only what you're authorized for") | API / Backend | Database (optional RLS defense-in-depth) | Enforced primarily via NestJS guards + Prisma query scoping; Postgres RLS is a v2/hardening addition, not required for v1 per CLAUDE.md's own phased guidance |
| Workspace list / role display | Browser / Client | — | Read-only rendering of API responses via TanStack Query cache |
| Local dev environment (Postgres) | Database / Storage (containerized) | — | Docker Compose Postgres 18 service; app runs via `pnpm dev` outside Docker for fast iteration, or `docker compose up` for a closer-to-prod check |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.x | Language | Locked project stack [CITED: ./CLAUDE.md] |
| Node.js | 24.x (Docker), local dev sandbox observed at 22.x | Runtime | Target 24 LTS for the Docker image per CLAUDE.md; local sandbox in this research session reported `v22.22.2` [VERIFIED: `node --version` in this environment] — not a blocker (Docker builds its own image), but the planner should pin `engines.node` in `package.json` to catch mismatches early |
| NestJS (`@nestjs/core`) | 11.1.28 confirmed current | Backend API framework | [VERIFIED: npm registry — `npm view @nestjs/core version` → 11.1.28, first published 2017] |
| `@nestjs/platform-fastify` | 11.1.28 (matches `@nestjs/core` major) | Fastify adapter for NestJS | [VERIFIED: npm registry] |
| PostgreSQL | 18.x | Datastore | Locked project stack [CITED: ./CLAUDE.md]; local Docker Compose service, not a host install |
| Prisma ORM (`prisma` CLI + `@prisma/client`) | 7.8.0 confirmed current | ORM / migrations | [VERIFIED: npm registry — both packages at 7.8.0] |
| `@prisma/adapter-pg` | 7.8.0 (pinned to Prisma major) | **Mandatory** Postgres driver adapter for Prisma 7 | Prisma 7 removed the Rust query engine; a driver adapter is required for every database, not optional. [CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7] — package name itself discovered via WebSearch, not yet cross-checked against Context7, so also [ASSUMED] per provenance rule; `npm view` confirms it exists and is maintained by the Prisma org (`repoUrl: github.com/prisma/prisma`) |
| `pg` | 8.22.0 | Postgres driver required by `@prisma/adapter-pg` | [ASSUMED — discovered via WebSearch, existence confirmed via `npm view`, not yet cross-checked against an official doc snippet in this session] |
| React | 19.2.7 confirmed current | Dashboard UI | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry] |
| Vite | 7.3.6 (latest 7.x) | Frontend build tool | CLAUDE.md pins "6.x/7.x" — npm registry's current overall latest is now `8.1.5`, released after CLAUDE.md's stack research. Recommend **7.3.6** to stay inside the locked range rather than adopting the newer major unreviewed. [VERIFIED: npm registry, version discrepancy flagged for planner awareness] |
| better-auth | 1.6.23 confirmed current stable (1.7 is beta/rc, do not use) | Auth core: sessions, email/password, organizations | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry — 1.6.23 is the latest non-prerelease version] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@prisma/config` (via `prisma.config.ts`, no separate install in 7.8) | bundled with `prisma` 7.8.0 | Datasource URL / driver adapter configuration | Prisma 7 moves `url`/`directUrl`/adapter wiring out of `schema.prisma` into a root `prisma.config.ts` file — required, not optional, for this version [CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7] |
| `zod` | 3.x/4.x per CLAUDE.md | DTO + frontmatter validation | Locked project stack [CITED: ./CLAUDE.md] |
| `nestjs-zod` | 5.4.0 confirmed current | Bind zod schemas to NestJS DTOs/pipes | Locked project stack (CLAUDE.md's zod row explicitly names it) [VERIFIED: npm registry, first published 2022] |
| `@nestjs/config` | 4.0.4 confirmed current | Env var loading/validation in NestJS | Official NestJS module for config; not explicitly named in CLAUDE.md's table but is the standard companion to any NestJS app reading `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc. [CITED: docs.nestjs.com/techniques/configuration] |
| `@tanstack/react-router` | 1.170.18 confirmed current | Dashboard client-side routing | CLAUDE.md leaves "React Router/TanStack Router" as an open choice. Recommend TanStack Router: full end-to-end type-safe routes/search-params/loaders, and it pairs naturally with the already-locked TanStack Query for a dashboard-shaped SPA. [MEDIUM confidence — WebSearch cross-checked across 3+ sources published 2026; this is Claude's-discretion territory per CLAUDE.md, flag for confirmation] |
| `@tanstack/router-plugin` | 1.168.23 | Vite plugin for TanStack Router codegen | Needed alongside `@tanstack/react-router` for file-based route type generation |
| TanStack Query | 5.101.2 confirmed current | Data fetching/cache | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry] |
| shadcn/ui + Tailwind CSS v4 | Tailwind 4.3.3 confirmed current | Dashboard components | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry for tailwindcss] |
| Vitest | 4.1.10 confirmed current | Test runner | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry] |
| pnpm | 10.33.0 (observed in sandbox), 11.15.0 latest on registry | Package manager | Locked project stack [CITED: ./CLAUDE.md]; sandbox has 10.33.0 installed — [VERIFIED: npm registry + local environment] |
| Turborepo (`turbo`) | 2.10.5 confirmed current | Monorepo task orchestration | Locked project stack [CITED: ./CLAUDE.md]; [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better-auth organization plugin mapped 1:1 to "Workspace" | Hand-rolled `Workspace`/`WorkspaceMember` Prisma tables, better-auth used only for authentication (not org/roles) | More control over the exact 3-level Tenant→Workspace→Role shape with zero library-imposed naming ("organization" vs "workspace"), but reimplements invitation flows, multi-membership queries, and role-checking helpers that the org plugin already provides. Not recommended for Phase 1 — higher effort for a foundation phase, revisit only if the org-plugin's role model proves too rigid in practice |
| better-auth org plugin's built-in `owner/admin/member` roles renamed | Fully custom `createAccessControl` statement with only `admin/editor/consumer` (no `owner`) | The org plugin's own docs treat `owner` as a protected role tied to "who can delete the organization" — recommend keeping `owner` internally (assigned to the workspace creator) while surfacing "Admin" as the user-facing role name for both `owner` and `admin` in the UI, OR accepting `owner` as a fourth implicit tier. This needs a concrete decision at plan time; flagged as Open Question below |
| `auth.handler` mounted directly (framework-agnostic) | `@thallesp/nestjs-better-auth` community adapter | The community package gives decorators (`@Session()`, `@AllowAnonymous()`) and less boilerplate, but its Fastify support carries CORS caveats per multiple sources and the package is ~1 year old with a single maintainer — flagged `[SUS]`. Recommended as a **documented alternative**, gated behind `checkpoint:human-verify`, not the default path |
| TanStack Router | React Router v7 (SPA/"library" mode, not framework mode) | React Router v7's advanced type-safety only applies in framework mode (SSR-oriented, which CLAUDE.md explicitly avoids); in plain SPA mode it has materially weaker typed search-params/loaders than TanStack Router. Simpler mental model and larger ecosystem familiarity, but weaker type safety for a dashboard-heavy app |

**Installation (apps/api):**
```bash
pnpm add @nestjs/core @nestjs/common @nestjs/platform-fastify @nestjs/config @nestjs/swagger \
  better-auth prisma @prisma/client @prisma/adapter-pg pg zod nestjs-zod
pnpm add -D prisma vitest @nestjs/testing
```

**Installation (apps/web):**
```bash
pnpm add react react-dom @tanstack/react-router @tanstack/react-query
pnpm add -D vite @vitejs/plugin-react @tanstack/router-plugin tailwindcss vitest
npx shadcn@latest init
```

**Version verification performed:** All version numbers above were confirmed via `npm view <pkg> version` against the live npm registry during this research session (2026-07-19), not taken from training-data memory.

## Package Legitimacy Audit

| Package | Registry | Age (first published) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------------------------|-----------|--------------|---------|-------------|
| better-auth | npm | 2024-04-22 (~2.2 yrs) | unknown (sandbox has no downloads API access) | github.com/better-auth/better-auth | Tool reported `SUS` (`too-new`/`unknown-downloads`) — **overridden to OK**: `too-new` is a false positive from the tool using latest-version-publish-date, not package-creation-date; `time.created` confirms 2024 origin, and it is CLAUDE.md's own locked stack choice | Approved |
| @nestjs/core, @nestjs/platform-fastify, @nestjs/config, @nestjs/swagger | npm | 2017/2018 | unknown (no downloads API in sandbox) | github.com/nestjs/nest, github.com/nestjs/config, github.com/nestjs/swagger | Tool reported `SUS` — **overridden to OK**: same false-positive pattern, all are 7-9 year old, extremely well-known first-party NestJS packages | Approved |
| prisma, @prisma/client, @prisma/adapter-pg | npm | 2023-09 (`@prisma/adapter-pg`), Prisma project itself much older | unknown | github.com/prisma/prisma | Tool reported `SUS` (`unknown-downloads` only, not `too-new`) — **overridden to OK**: official Prisma org packages, locked/required by CLAUDE.md and Prisma 7's own upgrade guide | Approved |
| pg | npm | long-established (`node-postgres`) | unknown | github.com/brianc/node-postgres | Tool reported `SUS` (`unknown-downloads`) — **overridden to OK**: the de facto standard Postgres driver for Node, required peer of `@prisma/adapter-pg` | Approved |
| zod, gray-matter, pg-boss, commander | npm | 2021-2016 range | unknown | respective official repos | Tool reported `SUS` (`unknown-downloads`, some `too-new` false positives) — **overridden to OK**, all locked in CLAUDE.md's stack table with prior research citations | Approved (gray-matter/pg-boss/commander not needed until Phase 2/5; listed for completeness only) |
| nestjs-zod | npm | 2022-05 (~4 yrs) | unknown | github.com/BenLorantfy/nestjs-zod | `SUS` (`unknown-downloads` only) — **overridden to OK**: named explicitly in CLAUDE.md's stack table | Approved |
| `@thallesp/nestjs-better-auth` | npm | 2025-06-15 (**~13 months old**) | unknown | github.com/ThallesP/nestjs-better-auth | Not run through the automated tool signal beyond initial pass, but independently flagged by this research: single-maintainer, community (not better-auth-official) package, and multiple sources describe its **Fastify support specifically as newer/beta with CORS caveats** — this is the exact adapter mode this project needs | **Flagged [SUS] by research** — do NOT default to this package. Recommend the framework-agnostic `auth.handler` mount instead (see Architecture Patterns). If the planner chooses to use this package anyway, gate behind `checkpoint:human-verify` |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `@thallesp/nestjs-better-auth` (and its Fastify-specific siblings `nestjs-better-auth-fastify`, `@roisuladib/nestjs-better-auth-fastify`, `@kylegillen/nestjs-fastify-better-auth` discovered during research — all are even younger/lower-adoption forks of the same idea and are **not recommended at all**; listed only so the planner recognizes and avoids them if surfaced by an LLM's training data during implementation).

*Note on the automated legitimacy tool in this environment:* `weeklyDownloads` returned `null` for every package checked (npm downloads API unreachable from this sandbox), and `publishedAt` reflects the **latest version's** publish date rather than the package's first-published date — this produced systematic `too-new` false positives for actively-maintained packages with recent patch releases (e.g. `@nestjs/core`, published 2017, flagged `too-new` because its 11.1.28 patch shipped last week). Verdicts above were manually cross-checked against `npm view <pkg> time.created` before being overridden.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│   Browser (React SPA)    │
│  Login/Register form     │
│  Workspace list view     │
└───────────┬──────────────┘
            │ fetch (credentials: include)
            │ dev: localhost:5173 → localhost:3000 (CORS + trustedOrigins)
            │ prod: same-origin (Fastify serves built SPA + API)
            ▼
┌────────────────────────────────────────────────────────┐
│  NestJS 11 + Fastify process (apps/api)                 │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Raw route: ALL /api/auth/*  → auth.handler(req)    │   │  ← better-auth core
│  │ (bypasses Nest's JSON body parser for this path)    │   │     handles hashing,
│  └──────────────────────────────────────────────────┘   │     sessions, org CRUD
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SessionGuard (custom)                              │   │
│  │  → auth.api.getSession({ headers: req.headers })    │   │
│  │  → attaches req.user, req.session                   │   │
│  └───────────────────┬──────────────────────────────┘   │
│                       ▼                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ WorkspaceRoleGuard (custom)                        │   │
│  │  → reads :workspaceId from route params             │   │
│  │  → auth.api.hasPermission({headers, body:{...}})    │   │
│  │    OR reads Membership row via Prisma                │   │
│  │  → 403 if user has no role in that workspace         │   │
│  └───────────────────┬──────────────────────────────┘   │
│                       ▼                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ WorkspacesController / WorkspacesService            │   │
│  │  - list (scoped to caller's memberships)             │   │
│  │  - create (Admin only, at Organization/Tenant level)  │   │
│  │  - grant-role (Admin only, per workspace)             │   │
│  └───────────────────┬──────────────────────────────┘   │
└──────────────────────┼────────────────────────────────────┘
                        ▼
              ┌───────────────────┐
              │ Prisma 7 Client     │  (via @prisma/adapter-pg,
              │ (driver-adapter)    │   no Rust engine)
              └─────────┬──────────┘
                        ▼
              ┌───────────────────┐
              │ PostgreSQL 18       │  (Docker Compose service)
              │ Tenant → Workspace   │
              │ → Membership(role)   │
              │ + better-auth's own  │
              │   user/session/      │
              │   account tables     │
              └───────────────────┘
```

### Recommended Project Structure
```
skillshare/
├── apps/
│   ├── api/                    # NestJS + Fastify backend
│   │   ├── src/
│   │   │   ├── auth/           # better-auth instance, SessionGuard, WorkspaceRoleGuard
│   │   │   ├── workspaces/     # WorkspacesModule (controller/service)
│   │   │   ├── main.ts         # Fastify bootstrap, bodyParser:false for /api/auth/*
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── prisma.config.ts    # Prisma 7: datasource url + adapter config lives here
│   └── web/                    # React 19 + Vite dashboard
│       ├── src/
│       │   ├── routes/         # TanStack Router file-based routes
│       │   ├── components/     # shadcn/ui components
│       │   └── lib/auth-client.ts
│       └── vite.config.ts
├── packages/
│   └── shared/                 # Zod schemas + TS types shared between api/web (permission types, DTOs)
├── docker-compose.yml          # postgres (18) [+ optionally api] for local dev
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```
`apps/cli`, `apps/mcp-server`, and `packages/skill-parser` are deferred to Phases 2/5 per the roadmap — do not scaffold empty stubs for them in Phase 1; Turborepo's workspace globs (`apps/*`, `packages/*`) will pick them up automatically when they're added later.

### Pattern 1: Framework-agnostic better-auth mount (recommended over community Nest-Fastify adapter)
**What:** Mount `auth.handler` as a catch-all Fastify route inside Nest, bypassing Nest's body parser for that path, and use `auth.api.getSession()` inside a hand-written guard for everything else.
**When to use:** Default approach for this phase, given the Fastify-specific risk flagged on `@thallesp/nestjs-better-auth` above.
**Example:**
```typescript
// Source: WebSearch synthesis of better-auth.com/docs/installation +
// better-auth.com/docs/integrations/fastify (framework-agnostic pattern) — [CITED, MEDIUM confidence]
// apps/api/src/main.ts
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
  { bodyParser: false }, // required so better-auth can read the raw request body on its routes
);

// apps/api/src/auth/auth.controller.ts (or a raw Fastify plugin registered before Nest's router)
@All('/api/auth/*')
async handleAuth(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
  const response = await auth.handler(toWebRequest(req)); // convert FastifyRequest -> standard Request
  await sendWebResponse(res, response);
}

// apps/api/src/auth/session.guard.ts
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) return false;
    (req as any).user = session.user;
    (req as any).session = session.session;
    return true;
  }
}
```
**Verification needed at implementation time:** the exact `FastifyRequest → standard Request` conversion helper (better-auth ships `toNodeHandler`/similar helpers for some frameworks but Fastify's raw-request shape needs explicit adaptation) — flagged as an Open Question below since no source in this session showed a complete, current Fastify-specific code sample.

### Pattern 2: Workspace-as-Organization with custom roles
**What:** Treat better-auth's `organizationPlugin` as this project's Workspace primitive; define custom Admin/Editor/Consumer roles via `createAccessControl`.
**When to use:** All workspace/role modeling in this phase.
**Example:**
```typescript
// Source: WebSearch synthesis of better-auth.com/docs/plugins/organization — [CITED, MEDIUM confidence]
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  skill: ["create", "edit", "submit", "approve", "publish"], // extended in Phase 2/3
} as const;

const ac = createAccessControl(statement);

const consumer = ac.newRole({ skill: [] });                    // read-only pull access
const editor  = ac.newRole({ skill: ["create", "edit", "submit"] });
const admin   = ac.newRole({ skill: ["create","edit","submit","approve","publish"], ...adminAc.statements });

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,
      roles: { admin, editor, consumer },
    }),
  ],
});
```
better-auth's UI-facing term stays "organization" internally (its own tables are named `organization`, `member`, `invitation`); expose it to users and in the Prisma schema comments as "Workspace" at the API/DTO layer.

### Pattern 3: Tenant parent table for DEPL-03 future-proofing
**What:** A minimal `Tenant` model that every Workspace (better-auth `organization` row) references, satisfying "organization-scoped data model from day one" without touching better-auth internals.
**When to use:** Add at schema-design time in this phase; v1 self-hosted seeds exactly one `Tenant` row at bootstrap.
**Example:**
```prisma
// Source: synthesized from common Prisma multi-tenant patterns [ASSUMED — no single authoritative
// source for this exact 3-tier shape; this is this research's own design recommendation]
model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  workspaces Workspace[] // "Workspace" here = better-auth's `organization` table, extended with tenantId
}

// If NOT extending better-auth's own `organization` table directly, add a 1:1 shadow table instead:
model Workspace {
  id             String   @id @default(cuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  betterAuthOrgId String  @unique // FK into better-auth's own `organization.id`
  createdAt      DateTime @default(now())
}
```
**Open question flagged below:** whether to extend better-auth's generated `organization` table directly (via its schema-extension hooks, if any) or maintain a parallel shadow table — needs a decision before Prisma schema is finalized.

### Anti-Patterns to Avoid
- **Trusting a client-submitted role field on registration or workspace-join:** always derive role assignment server-side from an Admin-initiated action; never accept `role` in a public signup DTO.
- **Checking permissions only in the dashboard UI:** every guard must be server-enforced (NestJS `CanActivate`); the UI hiding a button is not a security control (ORG-03 explicitly requires enforcement "in the dashboard and every API").
- **Using `prisma-client-js` provider or omitting `output` in the Prisma 7 generator block:** this is Prisma 6-era syntax; Prisma 7 requires `provider = "prisma-client"` and an explicit `output` path, or client generation fails.
- **Skipping the driver adapter:** instantiating `PrismaClient` without `@prisma/adapter-pg` in Prisma 7 removes the (former) Rust engine's implicit connection handling — this is now mandatory, not an optional performance opt-in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing, session token generation/rotation | Custom bcrypt/JWT session logic | better-auth core (`emailAndPassword` provider) | Locked project decision (CLAUDE.md); password hashing has enough subtle failure modes (timing attacks, weak defaults) that hand-rolling is explicitly out of scope per ASVS V6 guidance below |
| Multi-membership org/role data model + invitation flow | Custom `WorkspaceMember` join table with role enum from scratch | better-auth `organization` plugin (aliased to Workspace) | The plugin already solves multi-org membership, role storage, and invitation acceptance — reimplementing duplicates well-tested surface for no v1 benefit |
| NestJS role-check boilerplate scattered across controllers | Manual `if (user.role !== 'admin') throw ...` in every handler | `@Roles()` decorator + `Reflector`-based `RolesGuard`/`WorkspaceRoleGuard` pattern | Structural enforcement — a forgotten guard on a new endpoint is a much easier bug to introduce than a forgotten decorator is to catch in review; CLAUDE.md explicitly calls this out as the reason NestJS was chosen over Express |

**Key insight:** In this domain (permission-gated confidential legal content), every hand-rolled auth/permission shortcut is a direct violation of the project's hard security constraint ("unauthorized agents must never receive skill content"). Phase 1 should spend its complexity budget on getting the better-auth+Prisma+Fastify wiring right once, not on inventing a parallel permission system.

## Common Pitfalls

### Pitfall 1: Prisma 7 tutorials/blog posts still show `prisma-client-js`
**What goes wrong:** Following an older (pre-late-2025) Prisma+NestJS tutorial produces a `schema.prisma` that fails to generate a client, or generates into `node_modules` in a way Prisma 7 no longer supports.
**Why it happens:** Prisma 7 is a recent major version (dropped the Rust engine); most existing web content predates it.
**How to avoid:** Always use `provider = "prisma-client"` with an explicit `output`, add `@prisma/adapter-pg`, and move connection config into `prisma.config.ts`.
**Warning signs:** `Cannot find module '.prisma/client/default'` or similar import errors after `prisma generate`.

### Pitfall 2: Fastify + better-auth CORS/body-parsing mismatch
**What goes wrong:** Better-auth's mounted auth routes don't get covered by NestJS/Fastify's normal CORS or body-parser configuration, causing either broken cross-origin cookie auth in dev, or a raw-body parsing conflict where Nest's default parser consumes the request body before better-auth can read it.
**Why it happens:** Better-auth expects to own the raw `Request`/`Response` for its mounted path; Fastify's plugin/CORS model is different enough from Express (which most better-auth examples target) that app-level `@fastify/cors` doesn't automatically cover better-auth's routes.
**How to avoid:** Disable Nest's global body parser (`bodyParser: false`) and mount better-auth's handler as an early, dedicated route; configure CORS explicitly for the `/api/auth/*` prefix in addition to (not only via) any app-level CORS plugin; set `trustedOrigins` in the better-auth config to cover the Vite dev server origin.
**Warning signs:** Login/register works via curl/Postman (same-origin) but fails silently or with a CORS console error from the Vite dev server; session cookie never gets set from the browser.

### Pitfall 3: better-auth's default `owner`/`admin`/`member` role names leaking into UI
**What goes wrong:** Building UI/API around better-auth's default role labels instead of the project's required Admin/Editor/Consumer vocabulary, then having to retrofit custom roles later once workflows already assume the defaults.
**Why it happens:** The organization plugin ships with `owner`/`admin`/`member` out of the box; it's easy to start wiring against those before defining custom roles via `createAccessControl`.
**How to avoid:** Define the custom `admin`/`editor`/`consumer` roles (Pattern 2 above) as one of the first scaffolding tasks, before any controller/UI code references role strings.
**Warning signs:** Role strings like `"member"` appearing anywhere in `apps/web` or DTOs.

### Pitfall 4: Mass-assignment on the registration/role-grant DTOs
**What goes wrong:** A public `POST /auth/sign-up` or `POST /workspaces/:id/members` endpoint accepts a `role` field directly from the client, letting any registering user (or any workspace member with write access to the endpoint) self-assign Admin.
**Why it happens:** Convenient to add `role` to a shared DTO type and forget to strip it on the public path.
**How to avoid:** Zod/`nestjs-zod` schemas for public endpoints must not include a `role` field at all; role-grant is a separate Admin-only endpoint with its own guarded DTO.
**Warning signs:** A single `UpdateMemberDto` reused for both self-service profile updates and Admin role grants.

## Code Examples

### better-auth instance with Prisma 7 adapter
```typescript
// Source: WebSearch synthesis of better-auth.com/docs/adapters/prisma — [CITED, MEDIUM confidence]
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../generated/prisma"; // Prisma 7 custom output path, not @prisma/client
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
});
```

### NestJS Roles decorator + guard skeleton
```typescript
// Source: WebSearch synthesis of docs.nestjs.com/guards + common community RBAC pattern — [CITED/MEDIUM]
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata('roles', roles);

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const req = context.switchToHttp().getRequest();
    const workspaceId = req.params.workspaceId;
    const membership = await this.membershipService.findRole(req.user.id, workspaceId);
    if (!membership) return false; // no role in this workspace => no access, not "downgraded" access
    return required.includes(membership.role);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `prisma-client-js` generator, implicit `@prisma/client` import, Rust query engine | `prisma-client` generator with required `output`, `@prisma/adapter-pg` driver adapter, `prisma.config.ts` | Prisma 7 (late 2025) | Every pre-2025 Prisma+NestJS tutorial needs adaptation; do not copy-paste older sample `schema.prisma` files verbatim |
| Lucia for hand-rolled session auth | better-auth | Lucia deprecated March 2025 (project's own CLAUDE.md) | Already reflected in locked stack; no action needed, just confirming no drift |
| Vite 6.x/7.x as "current" | Vite 8.1.5 now latest on npm | Sometime between CLAUDE.md's research date and now (2026-07-19) | CLAUDE.md's pin ("6.x/7.x") predates Vite 8's release; recommend staying on 7.3.x for this phase rather than adopting an unreviewed new major, flagged for planner awareness |

**Deprecated/outdated:**
- Lucia (auth library): maintainer deprecated it March 2025; already excluded per CLAUDE.md's "What NOT to Use" — no action, just confirming no new information changes this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@prisma/adapter-pg` and `pg` are the correct/current driver-adapter packages for Prisma 7 + Postgres | Standard Stack, Code Examples | If the package name or API has since changed, Prisma client instantiation fails at scaffold time — low risk, caught immediately by `pnpm install`/build |
| A2 | The recommended 3-tier `Tenant → Workspace(=better-auth organization) → Membership(role)` model is the right shape for DEPL-03 | Architecture Patterns (Pattern 3), Summary | This is this research's own synthesis, not a documented better-auth pattern. If wrong, could mean a schema migration later when v2 multi-tenant SaaS mode is built — directly the risk DEPL-03 exists to prevent. **Highest-priority item for discuss-phase/plan-checker to interrogate** |
| A3 | Extending or shadow-tabling better-auth's `organization` table with a `tenantId` is mechanically feasible without breaking the plugin's own queries | Architecture Patterns (Pattern 3) | If better-auth's internal queries don't tolerate extra required columns or a shadow-table indirection cleanly, the Tenant-parent design needs rework before Prisma schema is finalized |
| A4 | `@thallesp/nestjs-better-auth`'s Fastify support has meaningful CORS/maturity gaps as described by secondary sources | Package Legitimacy Audit, Pitfall 2 | If this is overstated, the framework-agnostic recommendation trades away useful decorators/ergonomics for no real risk reduction — low-cost mistake, easily reversible |
| A5 | better-auth's `auth.api.hasPermission` / role-check APIs default-scope to the caller's *active* organization rather than accepting an arbitrary `organizationId` per call | Architecture Patterns (Pattern 1) | If wrong, the `WorkspaceRoleGuard` design needs to pass an explicit workspace/org ID per request rather than relying on an "active org" session concept — needs verification against the actual SDK surface at implementation time |
| A6 | TanStack Router is the better fit vs React Router v7 for this specific dashboard | Standard Stack (Supporting) | This is explicitly Claude's-discretion territory (CLAUDE.md names both); low risk either way, but should be confirmed rather than silently assumed if the user has a preference |

## Open Questions

1. **Does better-auth support extending its own generated `organization`/`member` tables with extra columns (e.g. `tenantId`), or must a parallel shadow table be used?**
   - What we know: better-auth's `auth generate` command produces its own Prisma schema fragment for its core tables; the organization plugin adds `organization`/`member`/`invitation` tables to that generated set.
   - What's unclear: whether the generated schema can be safely hand-edited/extended (and re-generation won't clobber those edits), or whether better-auth documents an official "additional fields" mechanism for plugin tables.
   - Recommendation: verify directly against the installed `better-auth` 1.6.23 package's generated schema output before finalizing Pattern 3; if extension isn't clean, default to the shadow-table (`Workspace.betterAuthOrgId` FK) design shown above.

2. **Exact Fastify request/response adaptation needed for `auth.handler`.**
   - What we know: better-auth's core expects standard `Request`/`Response` objects; it ships helpers for some frameworks (Next.js, Express via `toNodeHandler`) but no source found in this session showed a complete, current Fastify-native helper.
   - What's unclear: whether a `toNodeHandler`-equivalent exists for Fastify already, or whether the API/implementation phase needs to hand-write the Fastify-request → standard-Request conversion.
   - Recommendation: check better-auth's own `docs/integrations/fastify` page directly at implementation time (this session got a 403 on a direct `WebFetch` of `better-auth.com` — worth retrying via a different tool/MCP if available then) before committing to the exact adapter code.

3. **How is the `owner` role (protected, tied to "who can delete the workspace") reconciled with the project's 3-role Admin/Editor/Consumer vocabulary?**
   - What we know: better-auth's org plugin treats `owner` as a special protected role separate from custom roles.
   - What's unclear: whether Skillshare needs a fourth implicit "Owner" concept per workspace, or whether the workspace creator is simply granted the custom `admin` role and `owner` stays an internal-only implementation detail never surfaced in UI/API.
   - Recommendation: default to keeping `owner` purely internal (workspace creator gets `owner` + `admin` role, UI only ever shows "Admin"); confirm with user during discuss-phase if this needs to be user-visible.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | All apps | ✓ | v22.22.2 (sandbox) — Docker image should target 24.x per CLAUDE.md | Pin `engines.node` in root `package.json`; Docker build uses its own base image regardless of host |
| pnpm | Package manager | ✓ | 10.33.0 | — |
| Docker | Local Postgres + eventual full compose stack | ✓ | 29.3.1 | — |
| Docker Compose | Dev deployment | ✓ | v5.1.1 (CLI plugin) | — |
| PostgreSQL (host install) | Not required — DB runs in Docker | ✓ (client only: psql 16.13) | client v16.13, server will be 18.x in Docker | No fallback needed; host `psql` client version is irrelevant since Postgres runs containerized |
| git | Version control | ✓ | 2.43.0 | — |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** none — all required tooling is present in this environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (locked, CLAUDE.md) |
| Config file | none — see Wave 0 |
| Quick run command | `pnpm --filter api test` / `pnpm --filter web test` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | User registers + logs in with email/password | integration (API) | `pnpm --filter api vitest run auth.e2e-spec.ts` | ❌ Wave 0 |
| ORG-01 | Admin creates a workspace, sees it listed | integration (API) + component (web) | `pnpm --filter api vitest run workspaces.e2e-spec.ts` | ❌ Wave 0 |
| ORG-02 | Admin grants per-workspace role; role in one workspace confers nothing in another | integration (API) | `pnpm --filter api vitest run membership.e2e-spec.ts` — must assert cross-workspace isolation explicitly | ❌ Wave 0 |
| ORG-03 | User sees only authorized workspaces, in dashboard and every API | integration (API, list endpoint scoping) + e2e (dashboard, Playwright) | `pnpm --filter api vitest run workspaces.e2e-spec.ts` + `pnpm --filter web exec playwright test workspace-visibility.spec.ts` | ❌ Wave 0 |
| DEPL-03 | Data model is organization/tenant-scoped from day one | structural/schema test | `pnpm --filter api vitest run schema-tenant-scoping.spec.ts` — assert via Prisma DMMF introspection that scoped models carry a tenant/workspace FK | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter api test` (or `--filter web`) for the touched package
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts` — Vitest config for NestJS (needs `@nestjs/testing` module setup, e2e test app bootstrap using an ephemeral test database or Postgres testcontainer)
- [ ] `apps/api/test/auth.e2e-spec.ts`, `workspaces.e2e-spec.ts`, `membership.e2e-spec.ts`, `schema-tenant-scoping.spec.ts` — no test files exist yet (greenfield repo)
- [ ] `apps/web/vitest.config.ts` + Playwright config (`playwright.config.ts`) — dashboard has no test infra yet
- [ ] Test database strategy: decide between a Dockerized ephemeral Postgres for CI/tests vs. a shared dev database with per-test cleanup — not yet decided, needs a Wave 0 task
- [ ] Framework install: `pnpm add -D vitest @nestjs/testing supertest` (API), `pnpm add -D vitest @testing-library/react playwright @playwright/test` (web)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | better-auth `emailAndPassword` provider (scrypt-based hashing internally) — do not hand-roll |
| V3 Session Management | yes | better-auth httpOnly, secure, sameSite-configured session cookies; explicit `trustedOrigins` allowlist |
| V4 Access Control | yes | NestJS guards (`SessionGuard`, `WorkspaceRoleGuard`) as the single enforcement point per ORG-03/AUTH-01; deny-by-default (no membership row = no access, never a default role) |
| V5 Input Validation | yes | `zod` + `nestjs-zod` on every DTO; explicit allowlisting — public DTOs must never include a `role` field |
| V6 Cryptography | yes | Delegated entirely to better-auth's internal password hashing; never implement custom hashing/salting |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Broken access control / workspace ID tampering (IDOR: requesting another workspace's data by guessing its ID) | Elevation of Privilege | `WorkspaceRoleGuard` checks caller's actual membership row for the requested `:workspaceId` on every request; never trust a workspace ID without a corresponding membership lookup |
| Privilege escalation via role self-assignment | Elevation of Privilege | Role-grant is a separate Admin-only, server-validated endpoint; registration/self-service DTOs never accept a `role` field (Pitfall 4) |
| Session fixation / cross-origin cookie leakage in dev | Spoofing / Information Disclosure | Explicit `trustedOrigins`, `sameSite`/`secure` cookie flags configured correctly for both same-origin prod and cross-origin dev (Vite on 5173 → API on 3000) |
| SQL injection | Tampering | Prisma parameterized queries exclusively; no raw SQL string concatenation anywhere in workspace/role queries |
| CSRF against state-changing endpoints (create workspace, grant role) | Tampering | Rely on better-auth's origin-checking (`trustedOrigins`) plus `sameSite` cookie defaults; avoid GET-based state changes |

## Sources

### Primary (HIGH confidence)
- None this session — Context7 MCP was unavailable, so no tool-verified HIGH-confidence documentation fetch occurred. All findings below are WebSearch-derived (MEDIUM at best) or `npm view` registry-verified (HIGH for version/existence facts only, not for API-shape facts).

### Secondary (MEDIUM confidence — WebSearch cross-checked against official docs URLs)
- https://better-auth.com/docs/plugins/organization — organization plugin roles, access control, teams
- https://better-auth.com/docs/adapters/prisma — Prisma adapter setup, Prisma 7 output-path note
- https://better-auth.com/docs/integrations/nestjs — NestJS integration overview, bodyParser note
- https://better-auth.com/docs/concepts/cookies — cross-origin cookie/CORS configuration
- https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7 — Prisma 7 breaking changes (driver adapter mandatory, `prisma-client` provider, `prisma.config.ts`)
- https://docs.nestjs.com/guards — NestJS guards/RBAC pattern
- https://ui.shadcn.com/docs/installation/vite and https://ui.shadcn.com/docs/tailwind-v4 — shadcn/ui + Tailwind v4 + Vite setup
- https://pnpm.io/workspaces — pnpm workspace configuration
- `npm view <package> version|time.created|repository.url|scripts.postinstall` for: better-auth, @thallesp/nestjs-better-auth, @nestjs/core, @nestjs/platform-fastify, prisma, @prisma/client, @prisma/adapter-pg, pg, zod, gray-matter, pg-boss, commander, @nestjs/swagger, nestjs-zod, @nestjs/config, pnpm, turbo, vite, vitest, react, tailwindcss, @tanstack/react-router, @tanstack/react-query, @tanstack/router-plugin — all registry facts VERIFIED live against npmjs.org during this session

### Tertiary (LOW confidence — WebSearch only, community sources without an official doc cross-check)
- GitHub repos/npm pages for `@thallesp/nestjs-better-auth`, `nestjs-better-auth-fastify`, and similar Fastify-glue forks — used only to establish the SUS flag, not as a source of implementation-ready code
- Medium/DEV.to posts on pnpm+Turborepo monorepo scaffolding and Docker Compose hot-reload patterns — directionally useful, not verbatim-copyable
- Devtoolbox/PkgPulse blog comparisons of TanStack Router vs React Router v7 — used for the routing-library recommendation, flagged as Claude's-discretion in Assumptions Log (A6)

## Metadata

**Confidence breakdown:**
- Standard stack (package names/versions): HIGH for version/existence facts (registry-verified), MEDIUM for "is this the right package for the job" facts (WebSearch only, Context7 unavailable)
- Architecture (Tenant→Workspace→Role mapping onto better-auth): LOW–MEDIUM — this is a synthesized recommendation, not a documented pattern; flagged prominently for discuss-phase/plan-checker confirmation (see Assumption A2)
- Pitfalls (Prisma 7 breaking changes, Fastify+better-auth CORS): MEDIUM — cross-checked across 2+ independent WebSearch results per pitfall, including official Prisma docs for the Prisma 7 items

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (30 days — better-auth and Prisma are both fast-moving; re-verify version pins and the org-plugin schema-extension question before Phase 4/5 if significant time has passed)
