# Roadmap: Skillshare

## Overview

Skillshare grows from a permission-controlled foundation into a full skill registry and distribution hub. We start by establishing the access-control backbone (auth, workspaces, per-workspace roles) that every later capability enforces, then give non-technical authors a dashboard to write skills without git or raw YAML. Authoring is then wrapped in the four-eyes review-and-publish workflow that is the product's core value, producing immutable published versions. With published content in place we open the token-authenticated REST distribution channel, then meet agents where they live via the CLI sync tool and MCP server — both reusing the same authorization path. We close by surfacing the audit trail and usage analytics for compliance, and packaging the whole stack for one-command self-hosted deployment with a tested upgrade path.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Access Control** - Auth, workspaces, and per-workspace roles: the permission backbone
- [ ] **Phase 2: Skill Authoring in the Dashboard** - Non-technical markdown editor to create and edit skills (no git, no YAML)
- [ ] **Phase 3: Review & Publish Governance** - Four-eyes draft→review→publish workflow producing immutable versions
- [ ] **Phase 4: Token-Authenticated REST Distribution** - Scoped tokens and REST list/pull so authorized agents get published skills
- [ ] **Phase 5: CLI Sync & MCP Server** - `skillshare` CLI sync and MCP runtime discovery for agent-native distribution
- [ ] **Phase 6: Audit, Analytics & Compliance** - Audit log viewer, compliance export, and usage/staleness analytics
- [ ] **Phase 7: Packaging, Deployment & Upgrade** - One-command `docker compose up` with tested, data-preserving upgrades

## Phase Details

### Phase 1: Foundation & Access Control

**Goal**: A user can log in and see exactly the workspaces and roles they have been granted — the organization-scoped permission foundation every later capability enforces.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, ORG-01, ORG-02, ORG-03, DEPL-03
**Success Criteria** (what must be TRUE):

  1. A new user can register with email + password and log in to the dashboard.
  2. An admin can create workspaces (e.g. "Employment Law", "M&A", "Compliance") and see them listed.
  3. An admin can grant a user a role (Admin / Editor / Consumer) scoped to a specific workspace, and a role in one workspace confers no rights in another.
  4. A logged-in user sees only the workspaces and skills they are authorized for — unauthorized workspaces are absent, and the underlying data model is organization-scoped so a later multi-tenant mode needs no schema redesign.

**Plans**: 4/5 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Monorepo + toolchain + Docker Compose Postgres scaffold (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Prisma 7 org-scoped schema + walking-skeleton health slice (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Auth slice: register + login (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Workspace create + membership-scoped list (Wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-05-PLAN.md — Role grant + cross-workspace isolation (Wave 5)

**UI hint**: yes

### Phase 2: Skill Authoring in the Dashboard

**Goal**: A non-technical author (lawyer) can create and edit a skill in the dashboard using a markdown editor with structured metadata — no git, no terminal, no raw YAML.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SKIL-01, SKIL-02, SKIL-03, SKIL-04, SKIL-05, SKIL-07, WFLW-01
**Success Criteria** (what must be TRUE):

  1. An editor can create and edit a skill in Agent Skills format (SKILL.md: YAML frontmatter + markdown body) through the dashboard editor and structured metadata fields, without touching raw YAML, git, or a terminal.
  2. An editor can attach resource files (documents, scripts, templates) to a skill.
  3. When a skill has format errors, lint messages surface inline in the editor on save.
  4. An editor can bulk-import existing skills from an uploaded file/folder (e.g. a local `.claude/skills/` directory).
  5. A user can search and browse skills within their permitted workspaces by name, description, or tags, and saved drafts are never visible to Consumers.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Review & Publish Governance

**Goal**: A skill draft moves through a server-enforced four-eyes review to become an immutable, published version, with full history and rollback — the core governance loop.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: WFLW-02, WFLW-03, WFLW-04, WFLW-05, WFLW-06, WFLW-07, WFLW-08, AUDT-01
**Success Criteria** (what must be TRUE):

  1. An editor can submit a draft for review, and a different reviewer can approve or reject it — the server blocks an editor from approving their own draft (four-eyes principle).
  2. Before deciding, the reviewer sees a diff between the draft and the currently published version and can leave inline comments.
  3. Approval publishes a new immutable version; no edit path can change a published version's content afterward.
  4. A user can view a skill's full version history and roll back to a previous version — rollback creates a new version and never rewrites history.
  5. Every create, submit, approve, and publish action is recorded in an append-only audit log.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Token-Authenticated REST Distribution

**Goal**: An authorized agent can list and pull the latest published skills it is permitted to use over the REST API using a scoped access token — and unauthorized requests receive nothing.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: AUTH-02, AUTH-03, AUTH-04, DIST-01, DIST-02, DIST-05, SKIL-06
**Success Criteria** (what must be TRUE):

  1. A user can create a personal access token scoped to their permitted workspaces, set an expiry, and revoke it immediately (owner or admin).
  2. An agent can list its permitted skills and pull the latest published version of a skill via the REST API using its token.
  3. An efficient "is there a newer version" check returns a lightweight response without transferring full skill content.
  4. A request for a workspace or skill the token is not authorized for receives no skill content, and drafts and rejected versions are unreachable through the API at the data layer.
  5. Pulling a skill an admin has marked deprecated returns a deprecation warning to the consumer.

**Plans**: TBD
**UI hint**: yes

### Phase 5: CLI Sync & MCP Server

**Goal**: A project lawyer's agent gets its permitted skills automatically — synced to disk via the `skillshare` CLI and discoverable at runtime via the MCP server — both reusing the same authorization path as REST.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DIST-03, DIST-04
**Success Criteria** (what must be TRUE):

  1. A user can run the `skillshare` CLI to sync all permitted skills into a local skills directory (e.g. `.claude/skills/`).
  2. Re-running sync pulls only skills with newer published versions and reports what changed.
  3. An agent can discover and load its permitted skills at runtime through the MCP server endpoint.
  4. CLI and MCP enforce the same workspace permissions as REST — a cross-workspace request or a revoked/expired token fails on every channel.

**Plans**: TBD

### Phase 6: Audit, Analytics & Compliance

**Goal**: An admin can see who did what, prove it for compliance, and spot which skills are going stale.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: AUDT-02, AUDT-03, AUDT-04
**Success Criteria** (what must be TRUE):

  1. An admin can view and filter the audit log in the dashboard (by actor, action, resource, and time).
  2. An admin can export a compliance report showing who approved which skill version and when.
  3. An admin can see usage analytics: which token/agent pulled which skill, and which skills are going stale.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Packaging, Deployment & Upgrade

**Goal**: An operator can stand up the entire stack with one command and upgrade to a new release without losing data.
**Mode:** mvp
**Depends on**: Phase 5, Phase 6
**Requirements**: DEPL-01, DEPL-02
**Success Criteria** (what must be TRUE):

  1. Running a single `docker compose up` brings up the full stack (app + database) with no external dependencies to install first.
  2. Upgrading to a new Skillshare release runs database migrations automatically, following a documented and tested procedure.
  3. A tested upgrade from the previous release preserves all existing data (skills, versions, audit log, permissions).

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Access Control | 4/5 | In Progress|  |
| 2. Skill Authoring in the Dashboard | 0/TBD | Not started | - |
| 3. Review & Publish Governance | 0/TBD | Not started | - |
| 4. Token-Authenticated REST Distribution | 0/TBD | Not started | - |
| 5. CLI Sync & MCP Server | 0/TBD | Not started | - |
| 6. Audit, Analytics & Compliance | 0/TBD | Not started | - |
| 7. Packaging, Deployment & Upgrade | 0/TBD | Not started | - |

## Notes

**Requirement count:** REQUIREMENTS.md summarizes "32 total" but the enumerated v1 list contains 34 items (SKIL x7, WFLW x8, ORG x3, AUTH x4, DIST x5, AUDT x4, DEPL x3). All 34 are mapped below; the summary count in REQUIREMENTS.md is a miscount to reconcile.

**Deferred research safeguard (no v1 requirement):** Research flags injection-aware review / content-security scanning of SKILL.md (Pitfall #2) as a recommended safeguard and even a dedicated phase, but no v1 requirement backs it. It is partially served by the Phase 3 diff view (WFLW-05) where the reviewer inspects exactly what changed before approving. A dedicated content-security capability is left for the user to either add as a requirement or defer to v2 — it is not silently added to v1 scope here.
