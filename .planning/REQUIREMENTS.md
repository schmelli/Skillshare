# Requirements: Skillshare

**Defined:** 2026-07-19
**Core Value:** A permission-controlled single source of truth for agent skills: decentralized agents always pull the latest **approved** version of exactly the skills they are authorized to use.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Skill Management

- [ ] **SKIL-01**: Editor can create a skill in the Agent Skills format (SKILL.md: YAML frontmatter + markdown body) via the web dashboard
- [ ] **SKIL-02**: Editor can attach resource files (documents, scripts, templates) to a skill
- [ ] **SKIL-03**: Editor can author and edit skills in a markdown editor with structured metadata fields, without touching git or a terminal
- [ ] **SKIL-04**: Skill content is validated against the Agent Skills format on save and publish, with lint errors surfaced in the editor
- [ ] **SKIL-05**: Editor can bulk-import existing skills from uploaded files/folders (e.g. a local `.claude/skills/` directory)
- [ ] **SKIL-06**: Admin can mark a skill as deprecated; consumers pulling it receive a deprecation warning
- [ ] **SKIL-07**: User can search and browse skills within their permitted workspaces (name, description, tags)

### Governance Workflow

- [ ] **WFLW-01**: Editor can save skill drafts that are never visible to consumers
- [ ] **WFLW-02**: Editor can submit a draft for review
- [ ] **WFLW-03**: Reviewer can approve or reject a submitted draft; approval publishes it as a new version
- [ ] **WFLW-04**: An editor cannot approve their own draft (four-eyes principle, server-enforced)
- [ ] **WFLW-05**: Reviewer sees a diff between the draft and the currently published version before deciding
- [ ] **WFLW-06**: Reviewer can leave inline comments on a draft during review
- [ ] **WFLW-07**: User can view the full version history of a skill and roll back to a previous version (rollback creates a new version, history is never rewritten)
- [ ] **WFLW-08**: Published versions are immutable — no edit path can change a published version's content

### Workspaces & Roles

- [x] **ORG-01**: Admin can create and manage workspaces (e.g. "Employment Law", "M&A", "Compliance")
- [ ] **ORG-02**: Admin can grant users per-workspace roles (Admin / Editor / Consumer)
- [x] **ORG-03**: Users see only the workspaces and skills they are authorized for — in the dashboard and every API

### Authentication & Tokens

- [x] **AUTH-01**: User can register and log in with email and password
- [ ] **AUTH-02**: User can create personal access tokens scoped to their permitted workspaces
- [ ] **AUTH-03**: Tokens have an expiry date and can be revoked immediately by the owner or an admin
- [ ] **AUTH-04**: Every skill access across all channels (REST, CLI, MCP) enforces workspace permissions — unauthorized requests never receive skill content

### Distribution

- [ ] **DIST-01**: Agent can list its permitted skills via REST API using a token
- [ ] **DIST-02**: Agent can pull the latest published version of a skill via REST API, including an efficient "is there a newer version" check
- [ ] **DIST-03**: User can sync all permitted skills into a local skills directory (e.g. `.claude/skills/`) with the `skillshare` CLI
- [ ] **DIST-04**: Agent can discover and load its permitted skills at runtime via the MCP server
- [ ] **DIST-05**: All distribution channels serve only published versions — drafts and rejected versions are unreachable by consumers at the data layer

### Audit & Analytics

- [ ] **AUDT-01**: All security- and workflow-relevant actions (create, submit, approve, publish, pull, token events, permission changes) are recorded in an append-only audit log
- [ ] **AUDT-02**: Admin can view and filter the audit log in the dashboard
- [ ] **AUDT-03**: Admin can export a compliance report showing who approved which skill version and when
- [ ] **AUDT-04**: Admin can see usage analytics: which token/agent pulled which skill and which skills are going stale

### Deployment

- [ ] **DEPL-01**: The full stack starts with a single `docker compose up` (app + database, no external dependencies)
- [ ] **DEPL-02**: Upgrading to a new Skillshare release runs database migrations automatically and is documented and tested
- [x] **DEPL-03**: The data model is organization-scoped from day one so a later cloud/multi-tenant mode requires no schema redesign

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enterprise Identity

- **SSO-01**: User can log in via SSO/OIDC (Entra ID, Okta)
- **SSO-02**: Admin can map identity-provider groups to workspace roles

### Advanced Distribution

- **ADV-01**: Admin can promote skills through environment labels (e.g. pilot → org-wide)
- **ADV-02**: Editor can bundle related skills into skillsets with shared context
- **ADV-03**: Organization can run Skillshare as cloud/multi-tenant SaaS

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cross-organization marketplace / public skill sharing | Legal content is confidential; single-organization model is a core requirement |
| Skill execution / agent runtime in-app | Skillshare manages and distributes skills; it does not run agents — huge unrelated engineering investment |
| Git-based authoring as primary UX | Contradicts the "no git knowledge required" constraint; git stays an implementation detail at most |
| Real-time collaborative co-editing | High complexity (CRDT/OT) for a fundamentally sequential draft→review→approve workflow |
| Auto-approval or AI-only publishing | Defeats the four-eyes principle — publish always requires explicit human approval |
| Non-SKILL.md skill formats | Committed to the open Agent Skills standard for ecosystem compatibility |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 — Foundation & Access Control | Complete |
| ORG-01 | Phase 1 — Foundation & Access Control | Complete |
| ORG-02 | Phase 1 — Foundation & Access Control | Pending |
| ORG-03 | Phase 1 — Foundation & Access Control | Complete |
| DEPL-03 | Phase 1 — Foundation & Access Control | Complete |
| SKIL-01 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| SKIL-02 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| SKIL-03 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| SKIL-04 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| SKIL-05 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| SKIL-07 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| WFLW-01 | Phase 2 — Skill Authoring in the Dashboard | Pending |
| WFLW-02 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-03 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-04 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-05 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-06 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-07 | Phase 3 — Review & Publish Governance | Pending |
| WFLW-08 | Phase 3 — Review & Publish Governance | Pending |
| AUDT-01 | Phase 3 — Review & Publish Governance | Pending |
| AUTH-02 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| AUTH-03 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| AUTH-04 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| DIST-01 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| DIST-02 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| DIST-05 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| SKIL-06 | Phase 4 — Token-Authenticated REST Distribution | Pending |
| DIST-03 | Phase 5 — CLI Sync & MCP Server | Pending |
| DIST-04 | Phase 5 — CLI Sync & MCP Server | Pending |
| AUDT-02 | Phase 6 — Audit, Analytics & Compliance | Pending |
| AUDT-03 | Phase 6 — Audit, Analytics & Compliance | Pending |
| AUDT-04 | Phase 6 — Audit, Analytics & Compliance | Pending |
| DEPL-01 | Phase 7 — Packaging, Deployment & Upgrade | Pending |
| DEPL-02 | Phase 7 — Packaging, Deployment & Upgrade | Pending |

**Coverage:**

- v1 requirements: 34 total (enumerated list; the earlier "32 total" summary was a miscount)
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-19*
*Last updated: 2026-07-19 after roadmap creation (traceability populated, count corrected 32 → 34)*
