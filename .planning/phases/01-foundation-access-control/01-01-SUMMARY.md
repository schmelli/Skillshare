---
phase: 01-foundation-access-control
plan: 01
subsystem: infra
tags: [pnpm, turborepo, nestjs, fastify, vite, react, tanstack-router, tanstack-query, shadcn, tailwindcss-v4, vitest, docker-compose, postgres]

# Dependency graph
requires: []
provides:
  - "pnpm + Turborepo monorepo skeleton (apps/api, apps/web, packages/shared) with a build/test/lint/dev task pipeline"
  - "docker-compose.yml Postgres 18 service (healthcheck, named volume) — the DEPL-03 deployment substrate"
  - "NestJS 11 + Fastify API skeleton booting on :3000 with GET /api/health"
  - "React 19 + Vite 7 + TanStack Router/Query dashboard skeleton booting on :5173, shadcn new-york/neutral preset applied"
  - "Wave 0 Vitest harness (green) in apps/api and apps/web"
  - "@skillshare/shared workspace package resolvable and buildable"
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: [pnpm@10.33.0, turbo@2.10.5, typescript@5.9.3, "@nestjs/core@11.1.28", "@nestjs/platform-fastify@11.1.28", "@nestjs/config@4.0.4", fastify@5.10.0, vitest@4.1.10, "@nestjs/testing", supertest, "@nestjs/cli", react@19.2.7, "@tanstack/react-router@1.170.18", "@tanstack/react-query@5.101.2", vite@7.3.6, "@vitejs/plugin-react@5.2.0", "@tanstack/router-plugin", tailwindcss@4.3.3, "@tailwindcss/vite", "@testing-library/react", jsdom, clsx, tailwind-merge, lucide-react]
  patterns:
    - "Root tsconfig.base.json extended by every package; each package owns its own devDependencies (pnpm workspaces do not hoist binaries across packages)"
    - "turbo.json tasks: build depends on ^build; test/lint/dev are per-package"
    - "Fastify bootstrap uses bodyParser:false globally so better-auth (Plan 03) can own raw request bodies on /api/auth/*"
    - "Vite dev proxy (/api -> localhost:3000) instead of CORS-only for local dev DX; prod serves the SPA same-origin from the API (later phase)"
    - "components.json hand-authored to the classic shadcn schema (style/baseColor/cssVariables) because the shadcn CLI's `init` command has moved to a remote named-preset picker with no direct flags — see Deviations"

key-files:
  created:
    - pnpm-workspace.yaml
    - turbo.json
    - package.json
    - tsconfig.base.json
    - eslint.config.mjs
    - .prettierrc.json
    - docker-compose.yml
    - .env.example
    - packages/shared/package.json
    - packages/shared/src/index.ts
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/api/src/app.controller.ts
    - apps/api/vitest.config.ts
    - apps/web/vite.config.ts
    - apps/web/components.json
    - apps/web/src/index.css
    - apps/web/src/routes/__root.tsx
    - apps/web/src/routes/index.tsx
    - apps/web/vitest.config.ts
  modified:
    - .gitignore

key-decisions:
  - "Pinned typescript to 5.9.3 and vite to 7.3.6 (with @vitejs/plugin-react 5.2.0) instead of the registry's unpinned 'latest' (typescript 7.x, vite 8.x) to honor CLAUDE.md's locked stack versions, exactly as RESEARCH.md flagged"
  - "Hand-authored apps/web/components.json + src/index.css to the classic shadcn new-york/neutral/cssVariables=true schema, because `npx shadcn@latest init` now only offers a remote named-preset picker (Nova/Vega/Maia/...) with no --style/--baseColor flags; the classic schema is still consumed by shadcn's `add` command"
  - "docker-compose.yml/Postgres healthy-container acceptance criterion could not be exercised in this sandbox: the sandbox's egress proxy returned a hard policy denial (403) pulling postgres:18 from Docker Hub's CDN — config correctness was verified via `docker compose config` instead (see Deviations)"

patterns-established:
  - "Every workspace package declares its own build/test/lint scripts consumed by turbo.json's task pipeline"
  - "Wave 0 test harness convention: apps/api uses *.spec.ts under test/ (Vitest + node env), apps/web uses *.test.ts(x) under test/ or src/ (Vitest + jsdom)"

requirements-completed: [DEPL-03]

coverage:
  - id: D1
    description: "pnpm install resolves the pnpm+Turborepo workspace (apps/*, packages/*) with zero errors"
    requirement: DEPL-03
    verification:
      - kind: other
        ref: "pnpm install (root) — exit 0, confirmed twice across Task 2 and Task 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "pnpm turbo build builds apps/api, apps/web, and packages/shared green"
    requirement: DEPL-03
    verification:
      - kind: other
        ref: "pnpm turbo build — 3/3 tasks successful"
        status: pass
    human_judgment: false
  - id: D3
    description: "pnpm turbo test runs the Wave 0 Vitest harness in apps/api and apps/web and exits 0"
    verification:
      - kind: unit
        ref: "apps/api/test/smoke.spec.ts#test harness runs"
        status: pass
      - kind: unit
        ref: "apps/web/test/smoke.test.ts#test harness runs"
        status: pass
      - kind: other
        ref: "pnpm turbo test — 3/3 tasks successful"
        status: pass
    human_judgment: false
  - id: D4
    description: "The NestJS API boots on port 3000 with the Fastify adapter and bodyParser:false, and GET /api/health returns 200 {status:'ok'}"
    requirement: DEPL-03
    verification:
      - kind: integration
        ref: "manual: node dist/main.js && curl http://localhost:3000/api/health -> {\"status\":\"ok\"}"
        status: pass
    human_judgment: false
  - id: D5
    description: "The React 19 + Vite dev server boots on 5173 and renders the root route"
    verification:
      - kind: integration
        ref: "manual: pnpm --filter @skillshare/web dev && curl http://localhost:5173/ -> index.html served; pnpm --filter @skillshare/web run typecheck exits 0"
        status: pass
    human_judgment: true
    rationale: "Console-error-free rendering in an actual browser was not verified with a headless browser (Playwright is deferred to a later Wave 0 gap per RESEARCH.md); only server boot + HTML delivery + typecheck were automated-verified."
  - id: D6
    description: "docker compose up -d postgres starts a Postgres 18 container that reports healthy via its healthcheck"
    requirement: DEPL-03
    verification: []
    human_judgment: true
    rationale: "Could not be executed in this sandbox: pulling postgres:18 from Docker Hub's CDN was denied by the sandbox's egress policy (403, non-retryable per proxy policy). docker-compose.yml syntax/shape was verified via `docker compose config`; the human/CI environment (which has normal internet access) must confirm `docker compose up -d postgres` reports healthy before this plan's DEPL-03 substrate is considered fully proven."

duration: 15min
completed: 2026-07-19
status: complete
---

# Phase 1 Plan 1: Foundation Monorepo Scaffold Summary

**pnpm+Turborepo monorepo with a NestJS 11/Fastify API (`GET /api/health`), a React 19/Vite 7/TanStack dashboard skeleton with the shadcn new-york/neutral preset, a Docker Compose Postgres 18 service, and a green Wave 0 Vitest harness across all packages.**

## Performance

- **Duration:** ~15 min (Tasks 2-3; Task 1's blocking-human checkpoint was resolved in a prior session)
- **Completed:** 2026-07-19T16:12:56Z
- **Tasks:** 3 (Task 1 checkpoint carried over as resolved; Tasks 2 and 3 executed this session)
- **Files modified:** 34 (13 in Task 2's commit, 21 in Task 3's commit — see `git diff --stat`)

## Accomplishments

- Scaffolded the pnpm + Turborepo monorepo root (`pnpm-workspace.yaml`, `turbo.json`, root `package.json` with `packageManager pnpm@10.33.0` / `engines node>=24`, `tsconfig.base.json`, flat `eslint.config.mjs`, `.prettierrc.json`)
- `docker-compose.yml`: single `postgres:18` service, `pg_isready` healthcheck, named volume, no Redis/S3/MinIO — the DEPL-03 out-of-the-box deployment substrate
- `@skillshare/shared` workspace package builds cleanly via `tsc`
- `apps/api` (`@skillshare/api`): NestJS 11 + Fastify bootstrap (`bodyParser:false`, CORS via `WEB_ORIGIN`), `GET /api/health` returning `{status:'ok'}`, boots and responds correctly (manually verified)
- `apps/web` (`@skillshare/web`): React 19 + Vite 7.3.6 + TanStack Router/Query, dev proxy `/api -> localhost:3000`, shadcn `new-york`/`neutral`/`cssVariables=true` preset (hand-authored `components.json` + `src/index.css` — see Deviations), placeholder "Skillshare" index route, builds/typechecks/boots cleanly
- Wave 0 Vitest harness green in both `apps/api` and `apps/web`; `pnpm turbo build` and `pnpm turbo test` both exit 0 across all 3 packages

## Task Commits

Task 1 (checkpoint:human-verify, gate=blocking-human) — no commit; user approved `@prisma/adapter-pg@7.8.0` and `pg@8.22.0` against the npm registry in a prior session.

1. **Task 2: Monorepo toolchain + Docker Compose Postgres + shared package** - `d04d194` (feat)
2. **Task 3: NestJS+Fastify API skeleton + React+Vite dashboard skeleton + Vitest harness (Wave 0)** - `5e52304` (feat)

**Plan metadata:** (this commit, made by the worktree's `git_commit_metadata` step in worktree mode — SUMMARY.md + REQUIREMENTS.md only)

## Files Created/Modified

- `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json` — monorepo root config
- `docker-compose.yml`, `.env.example` — Postgres 18 service + env template
- `.gitignore` — extended for `node_modules`, `dist`, `.turbo`, `.env`, Prisma generated output, TanStack Router codegen
- `packages/shared/{package.json,tsconfig.json,src/index.ts}` — placeholder shared package
- `apps/api/{package.json,tsconfig.json,nest-cli.json,vitest.config.ts}` — API package config
- `apps/api/src/{main.ts,app.module.ts,app.controller.ts}` — Fastify bootstrap, health route
- `apps/api/test/{setup.ts,smoke.spec.ts}` — Wave 0 API test harness
- `apps/web/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,index.html,components.json}` — web package config
- `apps/web/src/{main.tsx,index.css,lib/utils.ts}` — app entry, Tailwind v4 theme, shadcn `cn` helper
- `apps/web/src/routes/{__root.tsx,index.tsx}` — TanStack Router root layout + placeholder index route
- `apps/web/test/smoke.test.ts` — Wave 0 web test harness

## Decisions Made

- Pinned `typescript@5.9.3` and `vite@7.3.6`/`@vitejs/plugin-react@5.2.0` explicitly, overriding pnpm's default resolution to the registry's newer majors (typescript 7.x, vite 8.x), to stay inside CLAUDE.md's locked stack versions — exactly the discrepancy RESEARCH.md flagged in advance.
- Hand-authored `apps/web/components.json` and `src/index.css` to the classic shadcn schema (`style: new-york`, `baseColor: neutral`, `cssVariables: true`) rather than running `npx shadcn@latest init` interactively, because the installed shadcn CLI (4.13.1) has replaced the old `--style/--base-color` flags with a remote named-preset picker (Nova/Vega/Maia/Lyra/Mira/Luma/Sera/Rhea/Custom) that has no non-interactive equivalent for "new-york + neutral" and would otherwise require a network round-trip to `ui.shadcn.com`. The classic schema fields are still read by the CLI's `add` command internally (confirmed via source inspection), so future component installs (Phase 2+) remain compatible.
- Added a `@/*` -> `./src/*` path alias in both `vite.config.ts` and `tsconfig.json`, and a minimal `src/lib/utils.ts` (`cn` helper via `clsx`+`tailwind-merge`), beyond the plan's exact `files_modified` list — required for `components.json`'s `aliases` block to be functional for any future `shadcn add` in Phase 2+ (Rule 2: missing critical functionality for the declared config to work).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pinned TypeScript and Vite to CLAUDE.md's locked versions instead of npm's resolved "latest"**
- **Found during:** Task 2 (root devDependency install) and Task 3 (web devDependency install)
- **Issue:** `pnpm add -Dw turbo typescript prettier eslint` resolved `typescript` to `^7.0.2` (a newer major than CLAUDE.md's locked `5.9.x`); `pnpm add -D vite` in `apps/web` resolved to `^8.1.5` (newer than CLAUDE.md's locked `6.x/7.x`, with `@vitejs/plugin-react@6.0.3` requiring `vite@^8.0.0`). RESEARCH.md explicitly flagged this exact drift as a known risk ("recommend 7.3.6 to stay inside the locked range").
- **Fix:** Re-ran `pnpm add -Dw typescript@5.9.3` and `pnpm add -D --filter @skillshare/web vite@7.3.6 @vitejs/plugin-react@5.2.0` (the plugin-react version whose peer range covers vite `^7.0.0`).
- **Files modified:** `package.json`, `apps/web/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm turbo build` shows `vite v7.3.6 building...`; `packages/shared` and `apps/api` build with `typescript@5.9.3` in their dependency graph.
- **Committed in:** `d04d194` (typescript), `5e52304` (vite/plugin-react)

**2. [Rule 3 - Blocking] shadcn CLI `init` no longer supports the UI-SPEC's `--style new-york --base-color neutral` flow non-interactively**
- **Found during:** Task 3 (dashboard scaffold)
- **Issue:** `npx shadcn@latest init` (resolved to v4.13.1) now prompts for one of 8 named presets (Nova/Vega/Maia/Lyra/Mira/Luma/Sera/Rhea) or "Custom" (which opens a browser flow at `ui.shadcn.com/create`) — there is no longer a direct `--style`/`--base-color` CLI flag matching UI-SPEC.md's `style=new-york, baseColor=neutral, cssVariables=true` preset, and none of the 8 named presets map to that exact combination (they use their own style-name space: `nova`, `vega`, etc., all defaulting to `theme: neutral` but a different structural style than classic `new-york`).
- **Fix:** Hand-authored `apps/web/components.json` using the classic schema shape (confirmed still present/read by the installed CLI's internals via source inspection: `style === "new-york"` literal checks exist in `chunk-UBIN4IG2.js`) and hand-authored `src/index.css` with the standard shadcn `new-york`/`neutral` Tailwind v4 CSS-variable theme (oklch tokens, `@theme inline` mapping), plus the UI-SPEC's accent/destructive brand tokens as named custom properties. Added `src/lib/utils.ts` (`cn` helper) and the `@/*` path alias so the `components.json` aliases are functional for future `shadcn add` runs.
- **Files modified:** `apps/web/components.json`, `apps/web/src/index.css`, `apps/web/src/lib/utils.ts`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`
- **Verification:** `pnpm --filter @skillshare/web run build` and `run typecheck` both exit 0; `components.json` acceptance criteria (`"style": "new-york"`, `"baseColor": "neutral"`) confirmed present.
- **Committed in:** `5e52304`

**3. [Rule 3 - Blocking, unresolved / environment limitation] `docker compose up -d postgres` blocked by sandbox egress policy**
- **Found during:** Task 2 verification (`docker compose up -d postgres && ... healthy`)
- **Issue:** The Docker daemon was not running in this sandbox (started manually via `dockerd &`); once running, `docker compose up -d postgres` failed pulling `postgres:18` from Docker Hub's CDN (`production.cloudfront.docker.com`) with a hard `403` policy denial from the sandbox's egress proxy. Per this environment's own operating instructions, policy denials (403/407) must not be retried or routed around.
- **Fix:** Not auto-fixable — this is a sandbox network-egress restriction, not a defect in `docker-compose.yml`. Verified everything within reach instead: `docker compose config` confirms the compose file parses correctly and produces the expected service shape (`postgres:18` image, `pg_isready` healthcheck, named `pgdata` volume, port `5432:5432`, no Redis/S3/MinIO).
- **Files modified:** none (config was already correct; no code change was needed)
- **Verification:** `docker compose config` output matches the intended service definition exactly.
- **Status:** Deferred to human/CI verification — flagged as `coverage: D6` with `human_judgment: true`. The real dev/deployment environment (with normal internet access to Docker Hub) is expected to succeed; this is purely a this-sandbox limitation, not a plan or config defect.

---

**Total deviations:** 3 auto-fixed/flagged (2 Rule 1/3 auto-fixes fully resolved in-session, 1 Rule 3 environment limitation deferred to human/CI verification).
**Impact on plan:** All three keep the delivered scaffold correct and within CLAUDE.md's locked stack; none represent scope creep or architectural change. D6 (Postgres container health) is the only acceptance criterion not directly proven in this session — everything else in the `must_haves.truths` list was verified.

## Issues Encountered

- Local sandbox Node.js is `v22.22.2`, not the `>=24` pinned in `engines.node` — this produces a `pnpm` `WARN Unsupported engine` on every install/run in this sandbox. Per RESEARCH.md's own Environment Availability note, this is expected and not a blocker: the `engines` field targets the Docker image build, and pnpm does not hard-fail on an engine mismatch (only warns) unless `engine-strict` is explicitly set, which it is not.
- `pnpm add -D vite @vitejs/plugin-react ...` triggered a `pnpm` "Ignored build scripts: esbuild" notice (pnpm's default no-postinstall-scripts security posture). Not addressed here since `vite build`/`vite dev`/`vitest run` all completed successfully without esbuild's postinstall script — esbuild ships platform-specific optional-dependency binaries that did not require it in this environment. Flagged for awareness if a future plan needs to `pnpm approve-builds`.

## User Setup Required

None - no external service configuration required. (`.env.example` documents `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`WEB_ORIGIN` for local `.env` setup, but none are consumed by real logic until Plan 02/03.)

## Next Phase Readiness

- The monorepo toolchain, API skeleton, dashboard skeleton, and Wave 0 test harness are all in place and green — Plan 02 (Prisma 7 schema + `prisma.tenant.count()` health read) and Plan 03 (better-auth register/login) can build directly on this scaffold without re-deriving tooling.
- **Blocker for a full DEPL-03 sign-off:** `docker compose up -d postgres` reporting `healthy` was not exercised end-to-end in this sandbox (Docker Hub pull blocked by sandbox egress policy). The compose file itself is verified correct via `docker compose config`; a human or CI environment with normal internet access should run `docker compose up -d postgres` once to confirm the healthcheck passes before Plan 02 assumes a live database connection.

---
*Phase: 01-foundation-access-control*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 12 referenced files (config, source, and this SUMMARY) confirmed present on disk; all 3 referenced commit hashes (`d04d194`, `5e52304`, and this plan's own metadata commit) confirmed present in `git log`.
