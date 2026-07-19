<!-- GSD:project-start source:PROJECT.md -->

## Project

**Skillshare**

Skillshare is an open-source hub for centrally creating, managing, and distributing AI agent skills (Anthropic Agent Skills / SKILL.md standard) to decentralized agents. A central team curates skills through a web dashboard with a review workflow; decentralized consumers (humans and their AI agents) pull the latest approved versions via REST API, CLI sync, or MCP server — gated by access tokens and workspace permissions. The first target audience is corporate legal departments that author legal skills centrally and distribute them to distributed teams of project lawyers across a corporate group.

**Core Value:** A permission-controlled single source of truth for agent skills: decentralized agents always pull the latest **approved** version of exactly the skills they are authorized to use.

### Constraints

- **Format**: Agent Skills / SKILL.md standard — ecosystem compatibility (Claude Code, Claude.ai) is a core bet
- **Deployment**: Docker Compose self-hosted must work out of the box — target users cannot run complex infra
- **Security**: Permission checks on every skill access — legal content is confidential; unauthorized agents must never receive skill content
- **Audience**: Dashboard UX must suit non-technical users (lawyers) — no git knowledge required
- **Licensing**: Open source — dependencies must be license-compatible

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.x | Language across entire stack | One language for API, dashboard, CLI, and MCP server lets you share a single `packages/shared` package for skill schema types, permission types, and Zod validators across all four surfaces. Directly serves the "coherent single-language stack" preference and avoids maintaining parallel Python + TS type definitions for the same domain model. |
| Node.js | 24.x (Active LTS) | Runtime | Node 24 is Active LTS as of mid-2026 (Node 22 is now Maintenance LTS, Node 26 is Current/not-yet-LTS). Target 24 LTS for the Docker base image for the longest supported runway; avoid Node 26 until it becomes LTS in October 2026. |
| NestJS | 11.1.x (`@nestjs/core`) | Backend API framework | Nest's modules + guards + decorators map directly onto this project's hardest requirement — enforcing role/workspace permissions on every skill access. Guards give you a single, testable enforcement point instead of scattered `if` checks. NestJS 11 defaults to SWC transpilation (fast builds) and ships Vitest support. Directly comparable prior art: Docmost (self-hosted collaborative content platform, same shape of problem — draft/publish workflow, workspaces, permissions) is built on NestJS + Fastify + Postgres and is a proven pattern at this scale. |
| Fastify adapter (`@nestjs/platform-fastify`) | 11.x-compatible | HTTP adapter for NestJS | Swap NestJS's default Express engine for Fastify: 30-40% more req/s than Express on JSON endpoints, matters when the same process is also serving REST pulls, CLI sync polling, and MCP tool calls from many agents. |
| PostgreSQL | 18.x (18.4+) | Primary datastore | PG18 is current stable (released Sept 2025, PG19 in beta as of July 2026 — do not target beta). Relational model fits skills/versions/workspaces/roles/grants cleanly; native Row-Level Security gives defense-in-depth workspace isolation on top of application-layer checks; JSONB covers flexible skill metadata/frontmatter fields; built-in full-text search is enough for skill search at this scale (no separate search service needed for v1). |
| Prisma ORM | 7.8.x | ORM / migrations | Prisma 7 (Nov 2025) dropped the Rust query engine — fully TypeScript now, 3x faster queries, ~90% smaller bundle, closing the historical gap with Drizzle. Skillshare runs as a long-lived Docker container (not edge/serverless), so Prisma's schema-first workflow and mature `prisma migrate deploy` — which a non-technical self-hoster's `docker compose up` entrypoint can run unattended — outweigh Drizzle's edge-cold-start advantage. |
| React | 19.x | Web dashboard UI | Current stable, required by the component ecosystem (shadcn/ui, MDXEditor) recommended below. |
| Vite | 6.x/7.x | Frontend build tool | Fast dev server and build; pairs with plain React Router/TanStack Router rather than Next.js — see "What NOT to Use" for why Next.js is skipped here. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-auth` + `@better-auth/api-key` + organization plugin | 1.6.23 | Auth: sessions, API keys, roles | TypeScript-native auth library designed to be self-hosted (not a hosted SaaS dependency), with an **API key plugin** (scoped keys — exactly the "personal access tokens scoped to workspaces" requirement) and an **organization plugin** (orgs + member roles/invitations — maps directly onto Workspaces + Admin/Editor/Consumer). Adding OIDC/SAML SSO later (the deferred v2 requirement) is a plugin, not a rewrite — satisfies "cloud-ready for later SSO" without building auth from scratch now. |
| `zod` | 3.x/4.x | Schema validation | Validate SKILL.md YAML frontmatter, API request/response DTOs (via `nestjs-zod`), and MCP tool input schemas. The official MCP TypeScript SDK already uses Zod internally for tool schemas, so one validation library covers the whole stack. |
| `gray-matter` | 4.x | Parse SKILL.md frontmatter | Standard library for splitting a markdown file into YAML frontmatter + body — exactly the SKILL.md format. Use on both write (dashboard save → SKILL.md) and read (CLI/MCP serving) paths so the stored format and the served format are always generated by the same code. |
| `@mdxeditor/editor` (MDXEditor) | 4.0.4 | Markdown WYSIWYG editor | MIT-licensed, purpose-built for "user sees formatted text, storage stays clean markdown" — the closest fit to "non-technical legal professionals must be able to author skills without touching git." Use for the SKILL.md **body**; render frontmatter fields (name, description, license, allowed-tools) as a normal structured form, not raw YAML, to keep it fully non-technical. |
| `diff` (jsdiff) + `react-diff-viewer-continued` | jsdiff 5.x / viewer 3.x | Version history diffs | MIT-licensed line-diff engine + a maintained React diff-viewer component for the "full version history with diff and rollback" requirement. |
| `pg-boss` | 10.x | Background jobs / queue | Postgres-backed job queue (MIT) — handles async work (e.g., regenerating diffs, notification emails, webhook delivery) **without adding a Redis container**. Keeps `docker compose up` to app + Postgres only, directly serving the "must work out of the box, target users cannot run complex infra" constraint. Swap to BullMQ + Redis only if/when the cloud/SaaS phase needs distributed rate-limiting or multi-instance job fan-out. |
| shadcn/ui + Tailwind CSS | Tailwind v4.x | Dashboard component system | Components are copied into your repo (Radix primitives underneath) rather than pulled as an opaque npm dependency — full styling control and no version-lock risk, good fit for an open-source project others will fork/theme. Accessible-by-default (Radix), which matters for a non-technical, potentially less tech-savvy user base. |
| TanStack Query | 5.x | Data fetching/cache (dashboard) | Standard pairing with a separate REST backend (Nest API); handles cache invalidation for draft/review/publish state transitions cleanly. |
| `@modelcontextprotocol/sdk` | 1.29.x | MCP server implementation | Official TypeScript SDK — the "native" language of the protocol per current community consensus. v1.x is the supported production line (v2 is beta, targeting the 2026-07-28 spec revision; do not build on v2 yet). Implement the Streamable HTTP transport with a custom API-key header check (reusing the same access-token validation as REST/CLI) rather than full OAuth 2.1 — appropriate since SSO/OAuth is explicitly deferred to v2 per PROJECT.md. |
| `commander` | 13.x | CLI framework (`skillshare` CLI) | ~35M weekly downloads, zero dependencies, ~20ms startup. The CLI only needs a handful of subcommands (`login`, `sync`, `pull`, `list`, `status`) — well inside Commander's sweet spot. oclif's plugin architecture is overhead this project doesn't need yet. |
| `@nestjs/swagger` | 8.x | OpenAPI docs | Auto-generates OpenAPI spec from Nest decorators — gives API consumers (and future generated SDKs) a documented contract for free. |
| `@aws-sdk/client-s3` | 3.x | Optional S3-compatible storage client | Only wired in behind a storage-driver interface (see Architecture note below) for the optional cloud/S3 backend — works unmodified against AWS S3, Cloudflare R2, or self-hosted SeaweedFS. |
| Vitest | 3.x | Test runner (all packages) | One test runner across API, web, CLI, MCP server and shared packages; NestJS 11 supports it natively, removing the historical Nest-defaults-to-Jest friction. |
| Playwright | 1.5x | Dashboard e2e tests | Usability by non-technical users is a first-class requirement — e2e coverage of the draft→review→publish flow and the markdown editor protects against regressions a unit test won't catch. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm (workspaces) | Package manager / monorepo linking | Strict, disk-efficient dependency resolution; required substrate for Turborepo below. |
| Turborepo | Monorepo task orchestration & caching | Right-sized for a ~5-6 package repo (`apps/api`, `apps/web`, `apps/cli`, `apps/mcp-server` or a `mcp` module inside `api`, `packages/shared`, `packages/skill-parser`). Minimal learning curve, incremental adoption, fast local+CI task caching. Do not reach for Nx unless the team/package count grows substantially (see "What NOT to Use"). |
| Docker Compose | Deployment packaging | Single `docker compose up`: an `api` service (NestJS, also serves the built React SPA as static files and mounts the MCP HTTP route) + `postgres`. Optional `caddy`/reverse-proxy service for automatic HTTPS on a real domain — document as recommended-but-optional, not required for local/eval use. |
| ESLint + Prettier (flat config) | Lint/format | Standard TS tooling; share one root config across the monorepo via Turborepo. |
| Changesets | Versioning/release notes | Fits an open-source repo with multiple publishable artifacts (npm CLI package, Docker image) needing coordinated version bumps and changelogs. |

## Installation

# Monorepo scaffold

# Backend (apps/api)

# Frontend (apps/web)

# CLI (apps/cli)

# Dev dependencies (root)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| NestJS + Fastify | Express | Only if the team explicitly wants minimal framework overhead over structure — but the RBAC/workspace-guard requirement is exactly what Nest's DI + guards are built for; Express requires hand-rolling that discipline. |
| NestJS (TypeScript) | FastAPI (Python) | Choose FastAPI only if the team has stronger Python expertise than TS/JS, or wants tighter integration with Python-only AI/ML tooling later. Breaks the single-language monorepo goal, since the dashboard and CLI need TS/JS regardless. |
| Prisma 7 | Drizzle ORM | Choose Drizzle if you expect to deploy the API to edge/serverless functions (cold-start-sensitive) in the cloud-ready phase, or if the team strongly prefers writing raw-SQL-shaped queries over a schema-first DSL. |
| better-auth | Custom session/JWT + hand-rolled roles table | Only if the team wants zero third-party auth dependency; expect to reimplement API-key hashing/rotation, org/role modeling, and the whole future-SSO integration surface yourselves. Not recommended given SSO is an explicit stated v2 goal. |
| pg-boss (Postgres-backed jobs) | BullMQ + Redis | Switch to Redis+BullMQ once running multi-instance (horizontal scale) or once you need sub-second job latency / pub-sub features Postgres LISTEN/NOTIFY-based polling can't match — realistically the cloud/SaaS phase, not v1 self-hosted. |
| Turborepo | Nx | Switch to Nx if the package count grows past ~10-15, multiple teams start owning separate apps, or you need generated code/architecture-boundary enforcement across a much larger surface. |
| Commander (CLI) | oclif | Switch to oclif if the CLI grows a plugin ecosystem (third parties writing `skillshare-plugin-*` extensions) or needs auto-generated docs/shell completion out of the box. |
| Local filesystem storage (default) + pluggable S3 driver | SeaweedFS / Garage / cloud S3 from day one | Add SeaweedFS (Apache-2.0) as an optional bundled service, or point the S3 driver at AWS S3/Cloudflare R2, once you operate a genuinely multi-instance or SaaS deployment where a shared network filesystem is required. For a single-container self-hosted v1, local disk (Docker volume) is simpler and has one fewer failure mode. |
| MDXEditor | Milkdown / Tiptap (headless) | Choose Milkdown if you need deep plugin-level customization of editing behavior; choose bare Tiptap if the dashboard needs a fully custom document model beyond plain markdown (e.g., embedded interactive blocks) — more engineering effort either way. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| MinIO (Community Edition) | Core server has been AGPLv3 since 2021; through 2025 MinIO progressively stripped user/policy management and admin features out of the free web console into a paid product, and the project has since gone into maintenance mode (one source reports the OSS repo archived April 2026). Both a licensing risk (AGPL) and a product-continuity risk for a project that explicitly requires "license-compatible" open-source dependencies. | Default to local filesystem storage for v1. If/when S3-compatible object storage is needed, use SeaweedFS (Apache-2.0, mature, 12+ years) or point directly at a managed S3-compatible service (AWS S3, Cloudflare R2) via the `@aws-sdk/client-s3` driver — do not self-host Garage either unless you're comfortable with AGPL's network-copyleft terms for anything that embeds it. |
| Next.js for the dashboard | Adds server-rendering/server-component complexity (and a second runtime surface to secure/deploy) that buys nothing here: the dashboard is a pure client talking to a separately versioned NestJS REST API that CLI and MCP clients also hit. Comparable self-hosted platforms in this space (Docmost, Outline) use a plain React SPA + Vite, not Next.js, for exactly this reason. | React + Vite SPA served as static files by the NestJS API service — one fewer container/runtime in the Docker Compose stack. |
| Lucia (auth) | The maintainer deprecated the npm `lucia` package in March 2025, sunsetting it as an actively maintained library and reframing the project as an educational reference for session-auth concepts rather than something to build on. | better-auth (actively developed, TS-native, has the API-key + organization plugins this project needs directly). |
| Raw Express with hand-rolled RBAC middleware | Workable, but every workspace-permission check becomes a manually-repeated `if` in each route handler — high risk of an accidentally-unguarded endpoint, which is unacceptable given "unauthorized agents must never receive skill content" is a hard security constraint. | NestJS guards, applied declaratively per-controller/route, so permission enforcement is structural rather than something a future contributor can forget to add. |
| oclif for a v1 CLI with ~5 subcommands | ~30 dependencies and 85-135ms startup for capability (plugin system, shell completion generation) this project doesn't need yet — pure overhead for a `sync`/`pull`/`login`/`status` tool. | Commander.js; migrate later only if the CLI grows a genuine plugin ecosystem. |
| Nx for the initial monorepo | Steeper learning curve and heavier conventions than a ~5-package repo needs; the "affected"/code-gen features pay off at a scale (10+ packages, multiple teams) this project isn't at during v1. | Turborepo + pnpm workspaces. |

## Stack Patterns by Variant

- Use FastAPI + Python MCP SDK (`mcp` package) for the API/MCP surface, keep React+Vite for the dashboard, and accept two languages in the monorepo (Turborepo/Nx both support polyglot task graphs).
- Because the Python MCP SDK is reported as the faster path to a first working server and integrates more naturally if later phases add ML/NLP-heavy skill-quality tooling — but this trades away the single-language type-sharing benefit that's otherwise a strong fit here.
- Swap pg-boss → BullMQ + Redis for distributed job processing and add Redis-backed rate limiting on the API/MCP endpoints.
- Swap local filesystem storage → S3-compatible driver (AWS S3 or Cloudflare R2) for multi-instance-safe blob storage.
- Turn on Postgres RLS with a `tenant_id`/`workspace_id` session variable in addition to the existing application-layer NestJS guards, for defense-in-depth once the blast radius of a bug is "another paying customer's data" rather than "another workspace in the same self-hosted install."
- Add SSO via better-auth's OIDC/SAML plugins — this was the explicit design reason for choosing better-auth over a hand-rolled auth layer.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| NestJS 11.x | Node.js 20+ (target 24 LTS) | Nest 11 supports native SWC transpilation; ensure `@swc/core` is pinned in the Docker build stage for reproducible builds. |
| Prisma 7.x | PostgreSQL 18.x | Use the new `prisma-client` provider (not the legacy `prisma-client-js`) in `schema.prisma` to get the Rust-free runtime. |
| better-auth 1.6.x + `@better-auth/api-key` | Prisma adapter | The API-key plugin's `userId` column was renamed to `referenceId` with a new `configId` field in recent releases — pin exact versions and check the plugin's migration notes before generating the Prisma schema for it. |
| `@modelcontextprotocol/sdk` 1.29.x | MCP spec revision predating 2026-07-28 | Do not mix v1 and the in-development v2 (`@modelcontextprotocol/server`/`client`) packages in the same server; v2 is beta and targets a spec revision not yet finalized as of this research date. |
| Vite 6.x/7.x | React 19.x | Use `@vitejs/plugin-react` at a version matching your Vite major; check for React 19-specific plugin updates if scaffolding from an older template. |

## Sources

- websearch (MEDIUM confidence, cross-checked across 2+ independent results per topic) — MCP TypeScript SDK version/positioning, NestJS vs Express/FastAPI for RBAC platforms, Postgres RLS best practices, MDXEditor vs Milkdown/Tiptap, MinIO license/maintenance-mode status, Turborepo vs Nx sizing guidance, Commander vs oclif, Prisma 7 vs Drizzle, self-hosted Docker Compose service-minimization pattern
- https://github.com/modelcontextprotocol/typescript-sdk — MCP TypeScript SDK, v1.x vs v2 status
- https://www.npmjs.com/package/@modelcontextprotocol/sdk — current version 1.29.0
- https://www.npmjs.com/package/@nestjs/core — current version 11.1.28
- https://www.postgresql.org/about/news/postgresql-184-1710-1614-1518-and-1423-released-3297/ — PostgreSQL 18.4 current stable, PG19 in beta
- https://nodejs.org/en/about/previous-releases and https://endoflife.date/nodejs — Node 24 Active LTS, Node 22 Maintenance LTS, Node 26 Current (not yet LTS)
- https://www.prisma.io/blog/announcing-prisma-orm-7-0-0 — Prisma 7 Rust-free release details
- https://www.npmjs.com/package/@mdxeditor/editor — MDXEditor v4.0.4
- https://better-auth.com/docs/plugins/api-key and https://better-auth.com/docs/plugins/organization — API key + organization plugin capabilities; version 1.6.23
- https://www.infoq.com/news/2025/12/minio-s3-api-alternatives/ and https://github.com/minio/minio/blob/master/LICENSE — MinIO AGPLv3 license and 2025 feature-stripping/maintenance-mode status
- https://deepwiki.com/docmost/docmost — Docmost stack as directly comparable prior art (NestJS+Fastify+Postgres+React/Vite self-hosted content platform)
- GitHub outline/outline — Outline's Node+Postgres+Redis+S3 architecture as a second comparable

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
