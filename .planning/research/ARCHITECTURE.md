# Architecture Research

**Domain:** Self-hosted registry/content-hub for AI agent skills (SKILL.md) — package-registry + headless-CMS-style draft/review/publish + agent-facing distribution (REST/CLI/MCP)
**Researched:** 2026-07-19
**Confidence:** MEDIUM (cross-checked across multiple independent sources on registry architecture, CMS draft/publish patterns, git-vs-DB content storage, multi-tenancy migration, and MCP server design; synthesis is opinionated architectural judgment applied to Skillshare's specific requirements, not a single authoritative source)

## Standard Architecture

Skillshare sits at the intersection of three well-understood system types, each contributing a proven pattern:

- **Private package registry** (npm/Verdaccio-style): REST API implementing a pull protocol, pluggable storage, auth-gated access, optional web UI.
- **Headless CMS with editorial workflow** (Contentful/Strapi-style): Draft → Review → Publish state machine, immutable versions, server-side enforcement of "who can publish," preview APIs for unpublished content.
- **MCP-exposed API** (GitHub MCP server pattern): a thin protocol adapter that wraps an existing REST API rather than reimplementing business logic, sharing the same auth.

Skillshare's architecture combines these: a single **Backend API** is the sole owner of business logic, data, and authorization; the **Dashboard**, **CLI**, and **MCP server** are three different *clients* of that one API — never independent authorities.

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                          CLIENT SURFACES                              │
├───────────────┬───────────────┬───────────────┬───────────────────────┤
│  Web Dashboard │  Agent (CLI)  │  Agent (MCP)  │  Agent (direct REST)  │
│  (humans,      │  `skillshare  │  Claude Code/ │  scripted pulls       │
│  session auth) │  sync`, PAT   │  other host,  │                       │
│                │                │  PAT via env  │                       │
└───────┬───────┴───────┬───────┴───────┬───────┴───────────┬───────────┘
        │ HTTPS          │ HTTPS          │ MCP over          │ HTTPS
        │ session        │ (REST, PAT)    │ streamable HTTP   │ (REST, PAT)
        ▼                ▼                ▼ (PAT), same authz ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    REVERSE PROXY / INGRESS (TLS)                      │
├───────────────────────────────────────────────────────────────────────┤
│                         BACKEND API SERVICE                           │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ ┌──────────┐ │
│  │ Auth Module    │ │ Workspace/    │ │ Skill Registry  │ │ MCP      │ │
│  │ (session +     │ │ RBAC Module   │ │ Module (state   │ │ Adapter  │ │
│  │ PAT resolution)│ │ (single choke │ │ machine, draft/ │ │ (mounted │ │
│  │                │ │ point)        │ │ review/publish, │ │ /mcp,    │ │
│  │                │ │               │ │ versions, diff) │ │ reuses   │ │
│  │                │ │               │ │                 │ │ authz)   │ │
│  └───────┬────────┘ └───────┬───────┘ └────────┬────────┘ └────┬─────┘ │
│          │                  │                  │                │      │
│  ┌───────┴──────────────────┴──────────────────┴────────────────┴───┐ │
│  │        Distribution Module (list/get/pull published versions,     │ │
│  │        scoped by resolved token → workspace/skill grants)         │ │
│  └──────────────────────────────┬──────────────────────────────────┘ │
│  ┌──────────────────────────────┴──────────────────────────────────┐ │
│  │              Background Worker (notifications, audit,             │ │
│  │              scheduled cleanup — Postgres-backed queue)           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────┬─────────────┘
                                │                            │
                    ┌───────────▼───────────┐   ┌────────────▼────────────┐
                    │   PostgreSQL           │   │  Object Storage          │
                    │  (users, workspaces,   │   │  (S3-compatible: MinIO   │
                    │  roles, PAT metadata,  │   │  in Compose, AWS S3      │
                    │  skill/version rows —  │   │  in cloud) — markdown    │
                    │  immutable, audit log) │   │  + resource bundles,     │
                    │  = SOURCE OF TRUTH for │   │  content-addressed,      │
                    │  state & permissions   │   │  namespaced per version  │
                    └─────────────────────────┘   └───────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Web Dashboard | Markdown authoring UI, metadata editing, resource uploads, review/approve UI, diff viewer, workspace/role admin | SPA (React/Vue) calling Backend API over session-authenticated REST/GraphQL; zero direct DB/storage access |
| Backend API Service | Single owner of business logic: workflow state machine, versioning, permission enforcement, PAT lifecycle, listing/search | Monolithic service (one deployable) with internal module boundaries; framework choice is a STACK.md decision |
| Auth Module | Resolves *who is calling*: dashboard session for humans, PAT for agents; issues/revokes/hashes tokens | Session cookies (or short-lived JWT) for humans; opaque, hashed, prefixed API keys for agents |
| Workspace/RBAC Module | Single choke-point authorization check: given (caller, workspace, skill) → allowed/denied; used identically by REST, CLI (via REST), and MCP | Membership table (user/token × workspace × role); middleware called before every content-bearing request |
| Skill Registry Module | Owns the Draft → Review → Publish state machine and immutable version history per skill | Postgres rows for metadata/state; content bytes stored as immutable blobs, referenced by content hash |
| Distribution Module | Agent-facing surface: list current published skills in scope, fetch a specific version, update-check | REST endpoints only — CLI and MCP both call this, never touch DB/storage directly |
| MCP Adapter | Runtime discovery/loading of permitted skills inside an agent's context | Thin wrapper mounted in (or proxying to) the Backend API; exposes `list_skills`/`get_skill` as MCP tools; reuses the same auth/authz path as REST |
| CLI (`skillshare`) | Local sync client: pulls permitted skills into `.claude/skills/`, tracks a lockfile, reports drift | Talks only to the Distribution REST endpoints with a stored PAT |
| Background Worker | Async work: review-requested/approved notifications, audit log writes, scheduled cleanup, (later) webhooks | Postgres-backed job queue (e.g. pg-boss/graphile-worker) to avoid a hard Redis dependency in the Compose stack; swappable later |
| PostgreSQL | Source of truth for structured, relational, transactional state: users, workspaces, roles, PAT metadata, skill/version metadata rows, audit log | One Postgres instance in Compose; RDS/Cloud SQL in cloud deployment |
| Object Storage | Immutable content bytes: SKILL.md markdown + resource bundle files per version | MinIO container in Compose (S3 API-compatible); real S3/GCS in cloud, same client code |
| Reverse Proxy / Ingress | TLS termination, single hostname for dashboard + API + MCP endpoint, first-run simplicity | Caddy or Traefik container with auto-TLS; makes `docker compose up` genuinely one command |

## Recommended Project Structure

```
skillshare/
├── apps/
│   ├── api/                 # Backend API service — the one source of truth
│   │   ├── src/
│   │   │   ├── auth/         # session auth (humans) + PAT resolution (agents)
│   │   │   ├── workspaces/   # workspace CRUD, membership, RBAC middleware
│   │   │   ├── skills/       # skill CRUD, draft/review/publish state machine
│   │   │   ├── versions/     # immutable version records, diff computation
│   │   │   ├── distribution/ # agent-facing list/get/pull endpoints
│   │   │   ├── mcp/          # MCP transport adapter mounted at /mcp
│   │   │   ├── audit/        # append-only audit log writes/queries
│   │   │   └── jobs/         # background worker task definitions
│   │   └── migrations/       # Postgres schema migrations
│   ├── dashboard/            # Web Dashboard SPA — client of the API only
│   │   └── src/
│   │       ├── editor/       # markdown + metadata authoring
│   │       ├── review/       # diff viewer, approve/reject UI
│   │       └── admin/        # workspace/role/PAT management
│   └── cli/                  # `skillshare` CLI — client of the API only
│       └── src/
│           ├── sync.ts       # pull permitted skills, write local files
│           └── lockfile.ts   # track last-synced version per skill
├── packages/
│   └── shared-types/         # skill/version/workflow-state contracts shared
│                              # by api, dashboard, cli, and MCP adapter
├── docker-compose.yml         # api + postgres + minio + proxy (+ dashboard)
└── docs/
```

### Structure Rationale

- **apps/api/ is the only component with database or object-storage access.** Dashboard and CLI are pure API clients — this is what makes "unauthorized agents must never receive skill content" enforceable in exactly one place instead of three.
- **mcp/ lives inside apps/api/** by default (not a separate app) so it shares the exact same auth/authz code path as REST at zero risk of drift; extract it into its own deployable later only if load or transport requirements diverge (the module boundary already exists, so extraction is a deploy change, not a rewrite).
- **packages/shared-types/** keeps the skill/version/workflow-state contract in one place so the dashboard, CLI, and MCP adapter can't drift from what the API actually returns — important because all three surfaces render the same underlying "published skill" concept differently.

## Architectural Patterns

### Pattern 1: Immutable Versions + Movable "Current" Pointer

**What:** Every Draft→Review→Publish transition that reaches "Published" creates a new, immutable version row (content + metadata never edited in place). The skill's "current published version" is a pointer that gets re-assigned on publish/rollback — it is never itself mutated in a way that changes history.
**When to use:** Always, for any content agents will pull and trust. This is the single most important pattern for the "legal content, confidential, must be exactly the approved version" constraint.
**Trade-offs:** Slightly more storage (mitigated by content-addressed dedup — an unchanged resource file is stored once and referenced by many versions) in exchange for a full, tamper-evident audit trail and trivial rollback (just re-point "current"; no destructive undo).

**Example:**
```typescript
// Publish is a single transaction: create version, then move the pointer.
async function publish(skillId: string, draftVersionId: string, approverId: string) {
  return db.transaction(async (tx) => {
    const version = await tx.skillVersions.insert({
      skillId, sourceDraftId: draftVersionId,
      contentHash: await hashDraftContent(draftVersionId),
      status: 'published', publishedBy: approverId, publishedAt: now(),
    }); // immutable row — never updated after this point
    await tx.skills.update(skillId, { currentVersionId: version.id }); // the only mutable pointer
    await tx.auditLog.insert({ actor: approverId, action: 'publish', skillId, versionId: version.id });
    return version;
  });
}
```

### Pattern 2: Single Authorization Choke Point, Reused by All Client Surfaces

**What:** One module resolves `(caller, requested workspace/skill) → allowed | denied`, called by every content-bearing endpoint — REST distribution, dashboard endpoints, and the MCP adapter alike. Neither the CLI nor the MCP server ever gets its own copy of permission logic.
**When to use:** Always here — this is the direct architectural answer to the "unauthorized agents must never receive skill content" constraint, and to the MCP-specific risk (surfaced in research) of permission logic drifting out of sync between a REST API and a separately-implemented MCP layer.
**Trade-offs:** Requires discipline to route every new surface through the same middleware rather than taking a shortcut; pays for itself the first time a permission bug would otherwise need fixing in three places instead of one.

### Pattern 3: Content-Addressed Object Storage for Skill Content, Not a Live Git Backend

**What:** SKILL.md text and resource bundle files are stored as immutable blobs in S3-compatible object storage, keyed by content hash and namespaced `organization/workspace/skill/version/`. Postgres holds the structured metadata and points to these blobs. Diffs between versions are computed on read (plain text diff on markdown, manifest diff on resource file lists) rather than via a git working tree.
**When to use:** For this project specifically — the audience is non-technical (legal professionals with "no git knowledge required" as an explicit constraint), so a real git-hosting backend (with its LFS-for-binaries workarounds and merge-conflict semantics) adds operational and UX complexity the requirements don't call for. The versioning/audit/rollback benefits research attributes to git-backed CMSs are achieved here via immutable version rows instead — same guarantees, none of the git-server operational surface.
**Trade-offs:** Loses git's native tooling (e.g., `git blame`, distributed clone) and branch/merge semantics; skill authoring here is linear (draft → review → publish → next draft), which matches the four-eyes workflow and does not need concurrent branching. If concurrent multi-author editing or branch/merge-style workflows become a real requirement later, that is worth a dedicated spike before assuming this pattern still fits.

## Data Flow

### Authoring → Review → Publish Flow

```
Editor (Dashboard)
    ↓ create/edit draft (session auth)
Backend API: Skill Registry Module
    ↓ write metadata (status=draft) → Postgres
    ↓ write content bytes → Object Storage (content-addressed)
    ↓
Editor submits for review
    ↓ state: draft → in_review (Postgres transaction)
    ↓ Background Worker: notify workspace Admins/Reviewers
    ↓
Reviewer (Dashboard)
    ↓ diff view: GET current-published-version vs draft (computed on read)
    ↓ approve → Backend API runs publish transaction (Pattern 1)
    ↓         → new immutable version row, "current" pointer moves, audit log entry
    ↓ reject  → state: in_review → draft, feedback recorded
```

### Distribution (Agent Pull) Flow

```
Agent (CLI: `skillshare sync`  |  MCP client: list_skills/get_skill)
    ↓ presents PAT (Authorization header or MCP env-configured token)
Backend API: Auth Module → resolves token → RBAC Module → allowed workspace/skill set
    ↓
Distribution Module: filters to CURRENT PUBLISHED versions only, within scope
    ↓
CLI: writes files to .claude/skills/<skill>/, updates local lockfile (skill → version pulled)
MCP: returns skill content directly into agent's runtime context (no local file write)
    ↓
Background Worker / Audit Module: records "token X pulled skill Y version Z at time T"
```

### Key Data Flows

1. **Write path (authoring):** Dashboard → Backend API → Postgres (metadata/state) + Object Storage (content bytes). Never bypassed — this is what keeps Draft/Review/Publish invariants and permission checks universally true.
2. **Read path (agent distribution):** CLI/MCP → Backend API (PAT resolved to scope) → Postgres (which version is "current" + is it in scope) → Object Storage (fetch the actual bytes) → response. Draft/in-review content is never reachable via this path — the Distribution Module only ever queries "current published version," structurally, not by convention.
3. **Audit trail:** every state transition and every distribution pull writes an append-only row, independent of the primary flow succeeding or failing on the happy path — this is a compliance requirement for the legal-department audience, not an afterthought.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users (single legal dept, few workspaces) — the v1 target | Monolith Backend API + single Postgres + single MinIO bucket + Compose is sufficient; do not split services prematurely |
| 1k-100k (multiple corporate groups, cloud/SaaS phase) | Add Redis cache for hot "resolve token → current published versions" queries (this is the read path agents hit constantly); move Object Storage to real S3; consider splitting the read-heavy Distribution Module from the write-heavy authoring/review API if they start contending for resources |
| 100k+ | Per-tenant isolation for compliance-sensitive enterprise customers (schema-per-tenant or DB-per-tenant for premium tier, per the "hybrid tenancy" pattern); dedicated Distribution API cluster with CDN in front of published content, since agent-pull traffic will dominate over authoring traffic at this scale |

### Scaling Priorities

1. **First bottleneck:** the Distribution Module's "resolve PAT → scoped current-published-versions" query, once many agents poll frequently for updates. Fix: cache this resolution (short TTL) before considering any service split.
2. **Second bottleneck:** Postgres write contention on the audit log at very high pull volume if every pull is logged synchronously. Fix: make audit-log writes async via the Background Worker queue rather than inline in the request path (worth deciding this even at small scale, since it's cheap to build right the first time).

## Anti-Patterns

### Anti-Pattern 1: Duplicated Authorization Logic Across Surfaces

**What people do:** Implement permission checks separately in the REST API, again in the MCP adapter (since MCP is "new" and gets built as if standalone), and sometimes a third time in the CLI for a "does this look allowed" UX shortcut.
**Why it's wrong:** The three copies drift. A permission fix applied to REST silently leaves the MCP path exposed — exactly the "MCP server as unauthenticated/under-authorized second attack surface" risk. For a product whose core value proposition is "unauthorized agents never receive skill content," this is the single highest-severity mistake available.
**Do this instead:** MCP adapter and CLI never implement authorization — they call the same Backend API endpoints (or, for MCP mounted in-process, the same internal service functions) that already enforce it. One authorization module, three consumers.

### Anti-Pattern 2: Mutable "Latest" That Overwrites History

**What people do:** Store "the current skill content" as a single row/file that gets overwritten on every publish, keeping a separate ad hoc "history" log as an afterthought.
**Why it's wrong:** This is the registry-world equivalent of the mutable-package-version failure mode — an agent that already pulled a version has no guarantee the same version number still means the same content, rollback requires reconstructing state instead of just re-pointing, and audit/diff become unreliable.
**Do this instead:** Every published version is its own immutable row from day one (Pattern 1); "current" is always a pointer, never the content itself.

### Anti-Pattern 3: Building the CLI or Dashboard Against the Database Directly

**What people do:** For speed, let the Dashboard's backend-for-frontend or the CLI query Postgres/Object Storage directly "just for reads," bypassing the API's business rules.
**Why it's wrong:** Any direct read path is a second place where "only return published, in-scope content" must be re-implemented and re-verified — and it's the easiest place for that rule to be forgotten under time pressure.
**Do this instead:** All access — reads included — goes through the Backend API. It is the only component with data-layer credentials.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Object Storage (S3-compatible) | S3 API client from Backend API only | MinIO in Compose, real S3/GCS/Azure Blob in cloud — same client code, config-only swap; this is what keeps the architecture "cloud-ready" without a rewrite |
| Email/notifications (optional, v1+) | Background Worker sends via SMTP or a transactional email API on review-state-change events | Not a hard dependency for MVP; workflow should function with in-app notifications alone if email isn't configured |
| Claude Code / MCP-compatible agent hosts | MCP client connects to Skillshare's `/mcp` endpoint (streamable HTTP) with a configured PAT | Treat this exactly like any other REST API consumer from an authz standpoint — see Pattern 2 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dashboard ↔ Backend API | HTTPS REST/GraphQL, session-authenticated | Dashboard holds zero business logic beyond UI state; all validation is re-enforced server-side |
| CLI ↔ Backend API | HTTPS REST, PAT-authenticated | CLI is intentionally "dumb" — sync + lockfile bookkeeping only |
| MCP Adapter ↔ rest of Backend API | In-process function calls (if mounted in the same service) or internal HTTP (if later extracted) | Must reuse Auth/RBAC modules verbatim, not reimplement |
| Backend API ↔ Postgres | ORM/query builder, all writes transactional (esp. publish) | Postgres is authoritative for state and permissions — never bypassed |
| Backend API ↔ Object Storage | S3 client, content-addressed keys | Content bytes are never trusted as authoritative for *state* (draft/review/published) — Postgres always is; storage just holds bytes |
| Background Worker ↔ Backend API | Shares the same DB/queue; triggered by domain events (state transitions, pulls) | Keeps notification/audit logic out of the synchronous request path |

## Sources

- [Verdaccio — private npm registry architecture](https://www.verdaccio.org/) — Express-based REST API, pluggable storage (filesystem default, S3/GCS plugins), configurable auth, optional web UI, proxy/uplinks
- [dotCMS — Headless CMS Checklist for Developers](https://www.dotcms.com/blog/the-headless-cms-checklist-for-developers) — draft/publish workflow patterns, immutable versioning with who/when/why metadata
- [Headless CMS Guide — Content Production Workflows](https://headlesscms.guide/guides/content-production-workflows) — multi-step Author→Editor→Legal→Publish workflows, server-side enforcement of publish permissions, preview APIs for draft content
- [CrafterCMS — Advantages of a Git-based Headless CMS](https://craftercms.com/blog/2022/04/advantages-of-a-git-based-headless-cms) — git-backed versioning/audit benefits and limitations (large binaries, real-time collaboration)
- [Decap CMS — Git-Based CMS: Definition, Features, Best Practices](https://decapcms.org/blog/git-based-cms-definition-features-best-practices/) — flat-file markdown storage in git repos vs database-backed CMS trade-offs
- [WorkOS — The developer's guide to SaaS multi-tenant architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — shared-schema/schema-per-tenant/DB-per-tenant patterns, workspace-as-tenant model
- [dev.to — Multi-Tenant SaaS Architecture: What Nobody Tells You Before You Build](https://dev.to/actinode/multi-tenant-saas-architecture-what-nobody-tells-you-before-you-build-a4h) — bridge tenancy as the recommended default for small teams; cost of retrofitting tenancy later
- [Model Context Protocol — Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture) — client-server model, Tools/Resources/Prompts primitives
- [Stainless — API MCP Server Architecture Guide for API Providers](https://www.stainless.com/mcp/api-mcp-server-architecture-guide/) — MCP servers as thin wrappers over existing REST APIs (GitHub MCP server pattern), single-responsibility server design, auth/audit logging best practices

---
*Architecture research for: self-hosted AI agent skill registry/hub (Skillshare)*
*Researched: 2026-07-19*
