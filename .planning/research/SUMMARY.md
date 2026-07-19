# Project Research Summary

**Project:** Skillshare (Self-Hosted AI Agent Skill Registry & Hub)
**Domain:** Permission-gated content registry + editorial workflow + multi-surface distribution (REST/CLI/MCP)
**Researched:** 2026-07-19
**Confidence:** MEDIUM

## Executive Summary

Skillshare is a specialized **content registry** (not an agent runtime, not a marketplace) designed for regulated enterprise environments where non-technical legal professionals must securely author, review, and distribute AI agent skills across a corporate network. It combines three proven patterns: private-package-registry architecture (versioning/permissions), headless-CMS editorial workflow (draft→review→publish), and multi-surface distribution (REST API + CLI + MCP server), all built in a single TypeScript monorepo using industry-standard tools (NestJS, PostgreSQL, React).

The research reveals a **high-confidence technology path** with clear precedents (Docmost, Outline, npm/Artifactory architecture) but **novel requirements** in the intersection: the combination of approval workflows + non-technical UX + permission-gated distribution is rare, and the MCP server adds complexity that must be carefully isolated to avoid duplicating authorization logic. The project is **operationally feasible** for self-hosted deployment at scale (0-1k legal department users) with Docker Compose, but has **hard architectural guardrails** (immutable published versions, workspace-scoped permissions, single auth choke point) that must be locked in early or require expensive retrofits.

**Top risks:** (1) allowing in-place mutation of published skill versions (breaks audit trail), (2) MCP server and REST API diverging on authorization (creates exploitable gaps), (3) roles not scoped per-workspace (confidentiality leak), (4) dashboard reintroducing the "need a developer" problem via raw markdown editing, (5) scope creep into agent execution features. All are preventable with disciplined architecture decisions made early in planning.

## Key Findings

### Recommended Stack

**One language, unified monorepo approach.** TypeScript end-to-end (Node.js 24 LTS, NestJS 11.x) allows sharing a single `packages/shared` type system across API, dashboard, CLI, and MCP server, avoiding the trap of parallel type definitions in Python+TS or multiple language runtimes. NestJS's module + guards architecture maps directly onto the "enforce role/workspace permissions on every skill access" requirement, with a single testable authorization choke point rather than scattered conditional checks.

**Core stack (all versions verified as of 2026-07-19):**

- **NestJS 11.1.x + Fastify adapter**: Backend API framework. Fastify's 30-40% throughput advantage over Express matters when the same process serves REST, CLI polling, and MCP tool calls. Guards-based RBAC is the structural answer to the "unauthorized agents must never receive skill content" constraint.
- **PostgreSQL 18.4+**: Primary datastore. Relational model fits skills/versions/workspaces/roles/grants cleanly; native Row-Level Security provides defense-in-depth isolation; JSONB covers flexible skill metadata; built-in full-text search is sufficient for v1.
- **Prisma 7.8.x (Rust-free)**: ORM + migrations. The Nov 2025 rewrite (no Rust runtime) closes the historical gap with Drizzle. For self-hosted long-lived containers (not edge), Prisma's schema-first workflow and automated `prisma migrate deploy` on boot beat raw SQL.
- **React 19.x + Vite 6/7.x**: Web dashboard. SPA served as static files by the API service (one fewer container); paired with TanStack Query for cache invalidation during draft/review/publish state transitions.
- **better-auth 1.6.23 + plugins**: Session auth for humans, API-key plugin for agent tokens, organization plugin for workspace management. Chosen because it is TS-native, self-hosted (not SaaS), and its plugin architecture keeps SSO/OIDC as a v2 addition, not a rewrite.
- **MDXEditor 4.0.4**: Markdown WYSIWYG editor. Purpose-built for "non-technical users write clean markdown without touching raw YAML." This is the core usability bet differentiating Skillshare from developer-first registries (Skilldex, Artifact proxies).
- **@modelcontextprotocol/sdk 1.29.x**: MCP server implementation. Production-stable v1.x; avoids in-development v2 targeting the unpublished 2026-07-28 spec revision.
- **Commander 13.x CLI**: ~35M weekly downloads, zero dependencies, fast startup. Right-sized for 5-6 subcommands (login/sync/pull/list).
- **pg-boss 10.x**: Postgres-backed job queue. Keeps `docker compose up` to app + Postgres only (no Redis), directly serving "must work out of the box for non-ops teams."

**What not to use:** ~~Lucia~~ (deprecated March 2025), ~~MinIO Community Edition~~ (AGPL licensing risk), ~~Next.js for dashboard~~ (unnecessary server-side complexity for a pure REST client), ~~Raw Express~~ (auth scattered across routes), ~~oclif~~ (plugin ecosystem overhead v1 doesn't need).

### Expected Features

**Three overlapping domains set feature expectations:** package registries (npm, Artifactory) define versioning/permissions/audit; prompt-hub tools (LangSmith, PromptLayer) define workflows for governed content; Agent Skills ecosystem (Skilldex arXiv 2604.16911, Anthropic skills) validates SKILL.md format and the need for non-technical authoring.

**Must have (table stakes — users expect from any "registry"):**
- Full version history with diff and rollback (immutable versions, never mutate published content in place)
- Draft → Review → Publish workflow with approval gate (this is the single biggest differentiator vs. commodity registries)
- Role-based access control (Admin/Editor/Consumer) scoped per workspace, not globally
- Workspace/namespace-based organization (maps 1:1 to legal practice areas)
- Immutable, tamper-resistant append-only audit log (non-negotiable for compliance)
- Scoped API keys with expiry/revocation (never blanket account access)
- REST API + CLI sync + MCP server for distribution
- Search/browse of skills within permitted scope

**Should have (competitive differentiators):**
- Non-technical markdown editor with live preview (the make-or-break UX bet for lawyers)
- Reviewer workflow with inline comments/redlines (domain-expert approval, familiar Word-like UX)
- Workspace-scoped usage analytics (who's pulling what, staleness detection)
- Format-conformance validation on save/publish (lightweight linting, not full execution)
- Import from existing skill sources (lower adoption friction for ad hoc skills already in use)

**Defer to v2+:**
- SSO/OIDC (enterprise IT requirement, but not needed to validate core loop)
- Skillsets/bundling (Skilldex's differentiator, but not essential for legal governance)
- Environment/label promotion (staged rollout beyond draft→publish, natural v1.x extension)
- Compliance export/reporting (high perceived value, low build cost — add when first customer requests it)
- Cloud/SaaS multi-tenant hosting (architecture stays cloud-ready, but ship self-hosted first)

**Anti-features (commonly requested, actively harmful):**
- Public marketplace (explicitly out of scope; legal content is confidential by nature)
- Git-based UX as primary authoring (contradicts "no git/terminal for lawyers")
- Real-time collaborative co-editing (unnecessary complexity; review workflow is sequential, not simultaneous)
- Skill execution/sandboxed running in dashboard (scope creep into agent runtime, massive surface area)

### Architecture Approach

**Single Backend API is the sole owner of business logic and authorization.** Dashboard, CLI, and MCP server are three pure API clients — none have direct database or storage access. This architecture ensures "unauthorized agents must never receive skill content" is enforced in exactly one place instead of three.

**Three structural patterns:**
1. **Immutable versions + movable "current" pointer:** Every Draft→Publish that reaches "Published" creates a new immutable version row (never edited in place). The skill's "current published version" is a reassignable pointer — rollback is just re-pointing, not destructive undo. This is the foundation for a tamper-evident audit trail.
2. **Single authorization choke point reused by all surfaces:** One module resolves `(caller, workspace, skill) → allowed | denied`, called by every content-bearing endpoint (REST, CLI via REST, MCP). The MCP adapter and CLI never implement authorization logic — they call the same Backend API functions. This prevents the "three separate implementations drift" anti-pattern.
3. **Content-addressed object storage for skill content:** SKILL.md + resource bundles stored as immutable blobs in S3-compatible storage, keyed by content hash, never a live git backend. Diffs computed on read (text diff on markdown), not via git working tree. Keeps the non-technical audience's UX clean (no git merge conflicts, no LFS complexity).

**Major components:**
- **Backend API (NestJS monolith):** Auth module (session + PAT), Workspace/RBAC module, Skill Registry module (draft/review/publish state machine), Distribution module (list/get/pull published versions), MCP Adapter, Audit log, Background worker for notifications/jobs.
- **Web Dashboard (React SPA):** Markdown editor + metadata fields, review diff view, workspace/role admin. Zero business logic; all validation re-enforced server-side.
- **CLI (`skillshare` binary):** Pulls permitted skills into `.claude/skills/`, maintains lockfile, reports drift. Talks only to Distribution REST endpoints.
- **Postgres + Object Storage:** Postgres = source of truth for state/permissions (users, workspaces, roles, skill metadata, audit log); S3-compatible = immutable content bytes.

### Critical Pitfalls

**Top 5 (in priority order for roadmap sequencing):**

1. **Mutable "latest approved version"** — Published skill versions get edited in place (fixing a typo), agents pull inconsistent content, audit trail becomes unreliable. *Prevent:* Every published version is immutable, content-hashed. No "edit" button on published content without forking to new draft. Expose content hash in API so consumers can verify.

2. **SKILL.md treated as inert markdown instead of active prompt-injection surface** — Malicious instructions (HTML comments, zero-width chars, hidden directives) embedded in a skill silently execute on every agent that pulls it, post-review. *Prevent:* Reviewer UI highlights suspicious constructs (comments, unusual unicode, embedded URLs/scripts). Bundled scripts scanned statically before publish. Diff view highlights injected patterns between versions.

3. **MCP server and REST API authorization diverges** — MCP built as a separate layer with weak/missing auth or different scoping rules; creates an under-authorized attack surface where unauthorized agents receive confidential content. *Prevent:* MCP adapter reuses the exact same Auth/RBAC modules as REST, never reimplements. Every skill-serving endpoint (REST, CLI, MCP) re-checks workspace+skill permission on every call. No unauthenticated MCP mode in any deployment profile (use a generated default token if needed).

4. **Roles not scoped per-workspace** — "Editor" becomes a global privilege; an M&A editor accidentally gets edit rights across all workspaces (Employment, Compliance, etc.). *Prevent:* Model roles as workspace-scoped grants from day one. Every authorization check answers "is this identity {role} *in this workspace*?" Never bare role checks. Token scopes must be workspace-bound.

5. **Docker Compose upgrade path never tested** — First upgrade after release loses data, fails to migrate, or requires manual intervention target users (legal department IT) cannot perform. *Prevent:* Pin image tags to specific versions (no `latest`). Document tested upgrade procedure. Seed data in CI, upgrade from vN-1, verify data integrity before release. Automated backup-before-migrate.

## Implications for Roadmap

Research suggests a **7-phase structure** ordered by dependency and risk mitigation:

### Phase 1: Core Data Model & Permission System
**Rationale:** Everything else depends on getting the permission model right. Roles must be workspace-scoped, versions must be immutable, and the token scoping model must be in place before any public API surface ships.
**Delivers:** 
- Postgres schema with workspace + user + role tables (roles workspace-scoped)
- Skill + version + audit-log tables (versions immutable)
- better-auth session + API-key plugin setup + organization plugin
- Token scoping model (workspace-bound, expiry, optional revocation)
**Avoids:** Pitfalls #1 (mutable versions), #4 (global roles), #6 (token sprawl)
**Research flag:** Token scoping design needs validation — verify the better-auth API-key plugin's recent `referenceId`/`configId` rename doesn't conflict with workspace-scoping model before committing schema.

### Phase 2: Draft → Review → Publish Workflow + Audit Log
**Rationale:** The core value proposition. Workflow state machine must be server-enforced before any content distribution happens.
**Delivers:**
- Skill state machine (draft → in_review → published) in Postgres
- Immutable version rows on publish (Pattern 1)
- Append-only audit log (actor, action, resource, timestamp)
- Reviewer permissions check (Admin/workspace-scoped must approve before publish)
- API prevents consumers from accessing draft/in_review content at the query level, not just UI
**Implements:** Architecture Pattern 1 & 2 (immutable versions, single auth choke point)
**Avoids:** Pitfalls #1 (mutable versions), #3 (MCP auth), #4 (role scoping)
**Research flag:** Diff computation strategy (text-diff library choice) — cross-check the jsdiff + react-diff-viewer-continued pair against production use.

### Phase 3: REST API Distribution Layer
**Rationale:** Agents need a stable pull mechanism. Build this before CLI/MCP so both clients share one authorization path.
**Delivers:**
- REST endpoints: `GET /workspaces/:id/skills` (listed scoped to token workspace), `GET /skills/:id/versions/:vid` (current published only), `POST /skills/:id/pull` (log pull event)
- Version/update-check endpoint returns lightweight hash, not full content (see Integration Gotchas)
- OpenAPI spec auto-generated via @nestjs/swagger
- All endpoints route through RBAC middleware (Pattern 2), no duplicate auth logic
**Uses:** NestJS + Fastify, @nestjs/swagger, Prisma queries (filtered by workspace scope)
**Avoids:** Pitfall #3 (MCP/REST divergence — this is the authoritative path)

### Phase 4: Web Dashboard & Markdown Editor
**Rationale:** Must validate the non-technical UX early — this is the product differentiator. High risk if built late.
**Delivers:**
- React SPA with TanStack Query (cache invalidation on state transitions)
- MDXEditor + structured frontmatter form (name, description, workspace, resources) — no raw YAML
- Draft/review/publish UI with clear status badges (Draft / In Review / Published vX)
- Diff viewer (current published vs. draft) with injection-aware highlighting (comments, URLs, unusual unicode)
- Audit trail visible: who created/reviewed/approved, when
- Workspace + role admin UI (invite users, set scoped roles, issue tokens)
**Avoids:** Pitfall #7 (dev-oriented UX), #2 (injection-blind review)
**Research flag:** Usability — prototype and test with a non-technical persona (ideally a lawyer) before considering Phase 4 complete. MDXEditor customization for skill-specific rendering may need a spike.

### Phase 5: CLI Sync Tool & MCP Server
**Rationale:** Both consume the REST API built in Phase 3. MCP is separated from dashboard to isolate its auth complexity.
**Delivers:**
- `skillshare` CLI: login (store PAT), sync (pull permitted skills into `.claude/skills/`, update lockfile), list, status
- MCP server: `list_skills` + `get_skill` tools, scoped to token workspace, mounted at `/mcp` in NestJS app
- Both reuse the exact Auth/RBAC modules from Phase 1-2 (no reimplementation)
- Automated tests: cross-workspace access must fail; expired/revoked token must fail
**Uses:** Commander (CLI), @modelcontextprotocol/sdk, TanStack Query (dashboard polling)
**Avoids:** Pitfall #3 (MCP divergence — both call same Backend API authorization)
**Research flag:** MCP streamable HTTP transport + PAT-via-header interaction — verify against real Claude Code / agent host integration (may need a spike with an MCP-compatible agent to validate the transport contract).

### Phase 6: Injection-Aware Review & Content Security Scanning
**Rationale:** Pitfall #2 (SKILL.md as prompt-injection surface) requires explicit tooling in review, not just four-eyes principle.
**Delivers:**
- Reviewer UI flags suspicious constructs in drafts: HTML comments, zero-width unicode, embedded URLs/script-like patterns
- Static analysis pass on bundled scripts/resources before publish (regex-based scan for network calls, credential access, exfiltration patterns)
- Diff view highlights added/changed injection-relevant elements (links, comments) between versions
- Documentation for admins: "You are the trust boundary; a compromised Editor account can poison every downstream agent"
**Implements:** Pitfall #2 prevention
**Research flag:** Lightweight static-analysis rules for skills — may need a dedicated research spike (e.g., "what patterns reliably detect malicious agent instructions without false positives?").

### Phase 7: Packaging, Deployment & Upgrade Path
**Rationale:** Docker Compose and upgrade testing are non-negotiable for self-hosted. Pitfall #5 is the failure mode if skipped.
**Delivers:**
- `docker compose.yml`: api (NestJS) + postgres + minio (local S3) + caddy (auto-HTTPS) — one command to start
- Migrations automated via `prisma migrate deploy` on api boot
- Pinned image tags (no `latest`), version-specific compose files
- Upgrade guide: tested procedure from vN-1 → vN with data preservation
- Backup/restore script + CI test (seed vN-1 data, upgrade to vN, verify integrity)
- Resource limits configured (prevent runaway containers on modest servers)
**Avoids:** Pitfall #5 (Docker upgrade breakage)
**Research flag:** ORM-level migration tool validation — confirm Prisma's auto-migration on boot is reliable for the expected upgrade scenarios (schema add, backfill, constraint change). May need Bytebase evaluation if Prisma proves brittle.

### Phase Ordering Rationale

1. **Permission model first (Phase 1):** Everything else depends on workspace-scoped roles and immutable versions. Getting this wrong early is the highest-cost mistake.
2. **Workflow + audit before distribution (Phase 2):** The approval gate must be enforced server-side before any API endpoint that serves skills exists.
3. **REST API before clients (Phase 3):** This is the authoritative source of truth for auth logic. CLI and MCP both consume it.
4. **Dashboard usability before "done" (Phase 4):** Non-technical UX is the differentiator. Testing it late means discovering that raw YAML authoring fails legal users' expectations only after the API is shipped.
5. **CLI + MCP together but after REST (Phase 5):** Both are pure API clients. They can be built in parallel once REST exists, but must share the authorization path to avoid divergence.
6. **Content security phase (Phase 6):** Builds on the review UI from Phase 4. Injection awareness is not a retrofit; it belongs in the core review workflow.
7. **Deployment/upgrade last (Phase 7):** Docker Compose is the final deliverable surface. Testing it against real upgrade scenarios is essential but happens after the app is feature-complete.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1:** Token scoping edge cases with better-auth (recent plugin API changes; need to validate that workspace-scoped grants compose correctly with role checks)
- **Phase 2:** Diff computation performance at scale (how does jsdiff behave on 10MB SKILL.md files? May need streaming diff or lazy-computed diffs)
- **Phase 4:** MDXEditor customization for skill frontmatter (may need a design spike to validate the "structured form + live preview" UX against a non-technical persona)
- **Phase 5:** MCP transport layer + agent-host integration (need real Claude Code / compatible agent environment to validate the streamable HTTP + PAT-header flow works end-to-end)
- **Phase 6:** Static-analysis rules for prompt-injection patterns (lightweight ruleset needed; may need a security research spike or partnership with a prompt-security tool)
- **Phase 7:** Postgres migration strategy at scale (Prisma auto-migrate is tested for typical cases; validate against large-schema + constraint-change scenarios)

**Phases with standard patterns (can skip research-phase):**
- **Phase 1 (permission model):** Workspace-scoped RBAC is a solved pattern (WorkOS, Render, Twenty). better-auth plugin model is documented. Standard patterns suffice.
- **Phase 3 (REST API):** NestJS + guards is a well-documented pattern for RBAC. OpenAPI codegen via @nestjs/swagger is standard. Standard patterns suffice.
- **Phase 4 (React dashboard):** React + TanStack Query cache invalidation is well-documented. Tailwind + shadcn/ui are standard. Standard patterns suffice.
- **Phase 5 (CLI):** Commander CLI is standard. MCP server architecture is documented in the official MCP guide. Standard patterns suffice.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | MEDIUM | All technology versions verified against npm/official release pages as of 2026-07-19. No official "Agent Skills registry best practices" doc exists, so tech choices are synthesized from comparable registries (npm, Artifactory) + CMS patterns (Docmost, Contentful). NestJS + PostgreSQL + React choices are high-confidence (proven on similar RBAC platforms); MDXEditor + better-auth plugin stack is lower-confidence (newer, fewer production deployments documented). |
| **Features** | MEDIUM | Feature landscape cross-checked across three product categories (registries, prompt hubs, Agent Skills ecosystem). "Draft→Review→Publish as a differentiator" confirmed by PromptLayer's positioning for regulated environments. Table-stakes features (versioning, audit log, RBAC) are standard across artifact registries. Non-technical UX gap is inferred from CMS research (Backstage TechDocs, dotCMS) — no direct survey of legal-department-specific requirements was possible in this research. |
| **Architecture** | MEDIUM-HIGH | Architecture patterns (immutable versions, single auth choke point, content-addressed storage) are direct synthesis of proven patterns from Verdaccio (private npm registry), dotCMS (headless CMS workflows), and GitHub MCP server (thin wrapper pattern). No single "golden standard" for "Agent Skills registry architecture" exists, so confidence is moderate. Scaling considerations (multi-instance, SaaS) are extrapolated from workOS/Render multi-tenant patterns, not tested against Skillshare. |
| **Pitfalls** | MEDIUM-HIGH | Pitfalls #1 (mutable versions), #3 (MCP auth divergence), #4 (workspace-scoped roles) are directly lifted from real-world failures documented in npm/Artifactory/GitHub research and multi-tenant SaaS postmortems. Pitfall #2 (prompt injection) is synthesized from arXiv studies (2601.10338v1, 2602.06547v1) on Agent Skills security. Pitfall #5 (Docker upgrade fragility) is a documented self-hosted software anti-pattern (e.g., Twenty, Supabase). Pitfall #7 (dev-oriented dashboard reintroducing git complexity) is inferred from CMS usability research (no direct survey of legal-profession UX). |

**Overall confidence: MEDIUM**

This research provides a **high-confidence technology foundation** (stack, architecture) with **well-founded feature expectations** (table stakes vs. differentiators) and **credible pitfall warnings** (grounded in real incidents + domain research). The project is **operationally feasible** with standard patterns. Confidence is capped at MEDIUM (not HIGH) because:
1. No official "Agent Skills ecosystem best practices" reference exists yet (the category is ~12 months old as of July 2026).
2. Non-technical UX expectations for legal professionals are inferred from CMS/ECM research, not direct legal-department interviews.
3. MCP server adoption patterns in production are still emerging (ecosystem stabilizing, but production deployments still sparse).

### Gaps to Address

1. **Non-technical UX validation:** This research assumes legal professionals' UX expectations can be inferred from CMS best practices. **Action:** During Phase 4 planning, prototype the dashboard editor + frontmatter form with an actual lawyer or legal operations professional (even informally) before considering design patterns locked in. The "structured form vs. raw YAML" trade-off is the highest-risk assumption.

2. **MDXEditor customization scope:** Research confirms MDXEditor is purpose-built for non-technical markdown authoring, but production customization needs for SKILL.md-specific rendering (e.g., dynamic resource link resolution, frontmatter field validation errors) are not documented. **Action:** During Phase 4 planning, allocate a 1-2 week design spike validating that MDXEditor's plugin API supports the required customizations without requiring a fork.

3. **Static-analysis rules for prompt-injection detection:** Pitfall #2 mentions "flag suspicious constructs," but research did not identify a lightweight, low-false-positive ruleset suitable for a review UI. Existing prompt-injection research (SkillJect, arXiv 2602.14211) focuses on attack generation, not real-time detection. **Action:** During Phase 6 planning, spike on "what are the minimal, reliable patterns that detect common injection vectors without false-alarming on legitimate skill content?" May need partnership with a prompt-security tool vendor.

4. **Postgres RLS for multi-tenant scenarios:** Research documents row-level security as a defense-in-depth layer for future cloud/SaaS phases (Phase X+), but this is outside the v1 self-hosted scope. No validation was performed on whether Prisma 7's ORM generates RLS queries correctly. **Action:** If multi-tenant SaaS is planned for post-v1, add "Postgres RLS + Prisma integration" to the Phase X research scope.

5. **MCP client-host integration testing:** MCP SDK docs and examples are stable, but real-world integration with Claude Code and other agent hosts is still emerging. The "streamable HTTP + PAT-via-header" transport contract assumed here may diverge from how Claude Code's MCP client actually implements token passing. **Action:** During Phase 5 planning, allocate time for an integration test spike with Claude Code (or a mock MCP-compatible client) before considering the MCP server phase complete.

## Sources

### High Confidence (Official Docs / Cross-Checked Web Search)
- https://nodejs.org/en/about/previous-releases — Node.js 24 Active LTS status
- https://www.postgresql.org/about/news/ — PostgreSQL 18.4+ stable release info
- https://www.npmjs.com/@nestjs/core, @nestjs/platform-fastify — NestJS 11.1.x + Fastify compatibility
- https://www.prisma.io/blog/announcing-prisma-orm-7-0-0 — Prisma 7 Rust-free runtime details
- https://better-auth.com/docs/plugins/api-key and /organization — better-auth plugin capabilities
- https://github.com/modelcontextprotocol/typescript-sdk — MCP v1.x vs. v2 status
- https://www.npmjs.com/@mdxeditor/editor — MDXEditor v4.0.4 capabilities

### Medium Confidence (Web Search, Cross-Checked Across 2+ Sources)
- npm/Artifactory/GitHub Packages audit trail + versioning patterns (multiple sources confirm version immutability as baseline)
- Headless CMS best practices (dotCMS, Contentful, Strapi docs on draft/review/publish workflow patterns)
- Verdaccio private npm registry architecture (Express-based REST, pluggable storage, standard auth patterns)
- Multi-tenant SaaS RBAC patterns (WorkOS blog + dev.to articles confirm workspace-scoped roles as standard)
- Agent Skills ecosystem (Skilldex arXiv 2604.16911, Anthropic skills GitHub, Agensi marketplace — confirm SKILL.md format and non-technical authoring need)
- MCP security / prompt-injection attacks (arXiv 2601.10338v1, 2602.06547v1, 2602.14211 on Agent Skills vulnerabilities; OWASP MCP tool poisoning)
- Self-hosted software upgrade pitfalls (Twenty, Supabase, dotCMS documentation on schema migration gotchas)

---

*Research completed: 2026-07-19*
*Ready for roadmap planning: yes*
