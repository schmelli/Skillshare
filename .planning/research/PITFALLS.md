# Pitfalls Research

**Domain:** Self-hosted AI agent skill registry/hub (permission-gated distribution of SKILL.md files, with dashboard, REST API, CLI, MCP server; first audience: corporate legal departments)
**Researched:** 2026-07-19
**Confidence:** MEDIUM (web-search synthesis, cross-checked across multiple independent sources; no curated official "gotchas" doc exists yet for this exact domain combination — Agent Skills registries are a very new category)

## Critical Pitfalls

### Pitfall 1: Mutable "latest approved version" — no true immutability of published skill versions

**What goes wrong:**
A published/approved skill version gets edited in place (fixing a typo, tweaking wording) without minting a new version number. Agents that already pulled v3 now silently get different content next sync, or worse, two agents running "the same skill version" are actually running different instructions — a nightmare for legal audit trails ("which instructions did the agent follow when it produced this advice on March 3rd?").

**Why it happens:**
It's tempting to let editors "just fix" a published skill rather than round-trip through draft → review → publish again, especially for small fixes. Registries that model versions as mutable rows (`UPDATE skills SET content = ... WHERE version = 3`) instead of immutable, content-addressed artifacts make this trivial to do by accident. npm's real-world incidents (node-ipc, eslint-config-prettier) show that even a mature registry with strong tooling still allows a *published* version's content to diverge from what reviewers/consumers believe it to be, once mutation is possible at all.

**How to avoid:**
Every published version is immutable and content-hashed (e.g., store a SHA-256 of the full SKILL.md + resources bundle alongside the version number). No API path may mutate a published version's content — only create a new draft based on it. The CLI/API/MCP server should expose the content hash so consumers can verify what they received matches what was approved. Rollback = publishing an old version's content as a new version, never reverting history.

**Warning signs:**
Any UI "Edit" button on a published/approved skill that doesn't fork into a new draft. Any database schema where `skill_versions.content` is `UPDATE`-able. No content hash exposed anywhere in the API/CLI output.

**Phase to address:**
Core versioning/data-model phase (early — this is a foundational data model decision, expensive to retrofit once real workspace data and audit expectations exist).

---

### Pitfall 2: SKILL.md content treated as inert data instead of an active prompt-injection surface

**What goes wrong:**
Because skills are just markdown + YAML frontmatter, it's easy to treat them as "just content" the same way you'd treat a CMS blog post. But SKILL.md is *executed* — its instructions land directly in an agent's context and get followed with the same trust as the system prompt. A malicious or compromised editor (or a compromised dependency in a bundled resource script) can embed hidden instructions (HTML comments, zero-width characters, instructions disguised as "example output") that get agents to exfiltrate data, auto-approve unsafe actions, or misbehave — and this happens on every agent that pulls the skill, invisibly, well after review.

**Why it happens:**
Teams building the registry think about *access control* to skills (who can read/write) but not about *content-level* review of what a skill's instructions actually cause an agent to do. Review workflow (four-eyes) is necessary but not sufficient — reviewers reading markdown for legal correctness are not reviewing it for injection patterns, hidden directives, or unsafe bundled scripts. Documented real-world pattern: hidden instructions in HTML comments directing an agent to auto-approve flagged actions or periodically exfiltrate context to an external endpoint.

**How to avoid:**
1. Reviewer UI should render/flag suspicious constructs (HTML comments, unusual unicode, embedded URLs/scripts) rather than only showing clean rendered markdown that hides them.
2. Bundled scripts/resources should be scanned (static analysis for network calls, credential access patterns) before publish, similar to VS Code/Chrome Web Store extension scanning.
3. Treat "distribution" as inherently higher-risk than "storage" — the MCP server and CLI sync are the actual attack delivery mechanism; log and rate-limit what gets pulled and by whom.
4. Document for legal-department admins that they are the trust boundary: a compromised Editor account can weaponize every downstream agent.

**Warning signs:**
Review UI shows only rendered markdown (comments/hidden text invisible). No script/resource scanning step in the publish pipeline. No changelog/diff view that highlights added URLs, `curl`/`fetch`-like patterns, or unusual formatting between versions.

**Phase to address:**
Draft → Review → Publish workflow phase (build the injection-aware diff/scan into review from day one — retrofitting review UX later means untrusted content has already been flowing to agents).

---

### Pitfall 3: MCP server and REST API exposed with weak or missing per-request authorization (unauthenticated or under-scoped endpoints)

**What goes wrong:**
The MCP server is built to "just work" for local dev — no auth on the endpoint, or auth exists but scoping is coarse (any valid token can list/read any skill regardless of workspace). Because MCP tool responses are trusted directly into agent context, an unauthenticated or under-scoped MCP endpoint doesn't just leak data — it lets an attacker plant poisoned tool descriptions/responses that get executed by any agent that connects, or lets an unauthorized workspace read confidential legal skill content.

**Why it happens:**
MCP tooling ecosystem norms (as of 2026) still commonly ship examples with no auth, and teams copy those patterns into production. Additionally, the MCP spec doesn't mandate client-side validation of server metadata, so even a "secured" server can still be poisoned if the transport itself isn't authenticated end-to-end. REST API and MCP server are easy to treat as two separate surfaces with duplicated (and inconsistently applied) auth logic.

**How to avoid:**
Single shared authorization layer used by REST API, CLI, and MCP server — never three separate implementations of "check the token." Every skill-serving code path (REST, CLI sync, MCP `list_skills`/`get_skill`) must independently re-check workspace + skill-level permission on every call, not just at token issuance. No unauthenticated MCP mode in any deployment profile, including local/dev docker-compose (use a default-generated token, not "no auth"). Treat MCP as equally security-critical as the REST API, not as a "convenience shim" bolted on afterward.

**Warning signs:**
MCP server has a different auth code path than the REST API. Any endpoint that trusts a workspace/tenant ID passed in the request body/query instead of derived from the verified token. Docker Compose default config that ships without requiring token setup before the MCP server responds to requests.

**Phase to address:**
Permission/token-scoping phase and MCP server phase — should share one authorization module; verify with explicit cross-workspace-access-must-fail tests before MCP phase is considered done.

---

### Pitfall 4: Roles not scoped per-workspace — "Admin" or "Editor" becomes a global privilege

**What goes wrong:**
The permission model implements Admin/Editor/Consumer roles but doesn't force every role assignment to be workspace-scoped. An Editor granted "Editor" without an explicit workspace binding accidentally gets edit rights across *all* workspaces ("Employment Law", "M&A", "Compliance") instead of just the one they were meant to manage. For a legal department, this is a serious confidentiality violation — an M&A editor should never be able to see or modify Employment Law skills.

**Why it happens:**
It's simpler to implement `user.role = 'editor'` as a global field than `user_workspace_roles(user_id, workspace_id, role)` as a join table, especially for an MVP. The mistake compounds because it "works" in testing with a single workspace and only surfaces once multiple workspaces with different sensitivity levels exist — exactly the corporate legal group's real deployment shape.

**How to avoid:**
Model roles as workspace-scoped grants from day one (`role` is always paired with a `workspace_id`, never a bare global field except for a genuinely global super-admin role that is rare and heavily audited). Every authorization check answers "is this identity {role} *in this workspace*?" — never a bare role check. Token scopes (API keys) must also be workspace-bound, not just role-bound, and this must be visible/settable in the dashboard when an admin issues a token.

**Warning signs:**
Any `role` column without an accompanying `workspace_id` on the same row. A token or session object that carries a single global role instead of a set of per-workspace grants. Inability in the dashboard to grant "Editor in workspace X only."

**Phase to address:**
Permission-model/RBAC phase (foundational — must be right before workspaces feature is used by more than one team, i.e., before first real multi-workspace legal department deployment).

---

### Pitfall 5: Docker Compose "works on my machine" self-hosting that breaks on upgrade

**What goes wrong:**
`docker compose up` works beautifully for the initial demo, but the first real upgrade (new image version, schema change) either loses data, fails to migrate, or requires manual intervention the target audience (legal department IT, not platform engineers) cannot perform. Common causes: named volumes not actually persisting the DB/skill-content storage; database migrations conflated with container init scripts (which only run once, not on every restart); `latest` tags making rollback impossible; no documented upgrade path between versions.

**Why it happens:**
Teams optimize the initial `docker compose up` demo experience (correctly, since it's a stated requirement) but don't invest equally in the *second* and *Nth* `docker compose up` after a `git pull` / image update — which is a fundamentally different operation (has existing data, may need migration, may need to be run in sequence across versions). Self-hosted products commonly discover this only once real users hit v1 → v2 upgrades.

**How to avoid:**
Pin image tags to specific versions in the shipped compose file, never `latest`. Ship a documented, tested upgrade procedure (even if manual: `docker compose down && git pull && docker compose up -d` with an app-level migration runner that runs automatically on container start, not an init script). Test upgrade-from-every-prior-minor-version as part of CI/release process, not just fresh installs. Automated backup-before-migrate step, and a documented/tested restore procedure (an untested backup is not a backup). Resource limits set in the compose file so one runaway container doesn't take down the whole stack on a modest legal-department server.

**Warning signs:**
No `MIGRATIONS.md` or equivalent upgrade doc. Compose file uses `image: skillshare:latest`. No automated migration runner triggered on app boot. Backup/restore only ever tested in the "happy path" direction (backup taken, never restored).

**Phase to address:**
Packaging/deployment phase — should be validated with an explicit "upgrade from vN-1" test before every release, not just fresh-install testing. Flag for deeper research at that phase (migration tooling choice, e.g. built-in ORM migrations vs. standalone tool).

---

### Pitfall 6: API keys with no scoping, expiry, or revocation visibility ("token sprawl")

**What goes wrong:**
Tokens are issued once, work forever, and are scoped only loosely (e.g., "this token can read this workspace" but not "this token can only read, not list all skill names" or similar least-privilege detail). Nobody in the dashboard can see which tokens exist, who issued them, when they were last used, or revoke one without regenerating all of a user's tokens. A former project lawyer's laptop with a still-valid, never-expiring token becomes a standing risk that nobody tracks.

**Why it happens:**
Token issuance is easy to build ("generate random string, store hash, done") but the *lifecycle* half (listing, last-used tracking, expiry, scoped revocation, audit log of what was pulled with which token) is significantly more work and gets deprioritized for MVP. This exactly mirrors the generic enterprise API-key sprawl problem, but is worse here because tokens gate access to confidential legal content, not just API usage quota.

**How to avoid:**
From v1: tokens are scoped to specific workspaces (not "all workspaces the user can see"), have an optional/default expiry, are individually named and revocable from the dashboard, and every pull (REST/CLI/MCP) is logged with token identity + timestamp + skill(s) accessed. Dashboard shows "last used" per token so admins can spot dead/stale tokens. Support token rotation without downtime (issue new, grace-period overlap, revoke old) since legal department IT will not tolerate an outage from key rotation.

**Warning signs:**
No token list/management UI in the dashboard — only "generate a new token" with no visibility into existing ones. No expiry field on tokens. No access log tied to token identity.

**Phase to address:**
Token/API-key phase, alongside the permission-model phase — token scoping model and workspace-role model should be designed together, not sequentially.

---

### Pitfall 7: Dashboard designed for developers, not lawyers — reintroducing the "need a developer to publish" bottleneck

**What goes wrong:**
The stated core value is that non-technical legal professionals author and manage skills without touching git or a terminal — but the editor ends up being a raw markdown textarea with YAML frontmatter exposed directly, no live preview of how the skill will render/behave, unclear indication of draft vs. published state, and no clarity on "who approved this and when." This silently reintroduces the git-and-terminal problem the product exists to remove, just moved into a browser tab.

**Why it happens:**
It's the path of least engineering resistance to expose the underlying file format directly in the UI ("it's just markdown, ship a textarea"). Teams underestimate how much structure non-technical users need: guided metadata fields instead of raw YAML, a live preview, clear status badges, and a visible, named approval trail — because a "who approved this" gap is exactly the failure mode documented in general CMS approval-workflow research (unclear ownership, drafts accidentally published, rushed reviews).

**How to avoid:**
Structured form fields for skill metadata (name, description, workspace, resources) with YAML generated behind the scenes, not hand-edited. A rendered/live preview of the skill content, not just a raw markdown editor. Explicit, unmissable status indicators (Draft / In Review / Published vX) on every skill. An audit trail visible in the UI: who created the draft, who reviewed, who approved, when — not just in a database log nobody can see. Design and usability-test with an actual non-technical persona (a lawyer, not a developer) before considering the dashboard phase done.

**Warning signs:**
The skill editor is a single unstructured text area with no field validation. No preview mode. No visible "approved by X on Y" trail in the UI. Internal team says "well, it's basically markdown, lawyers can figure it out."

**Phase to address:**
Dashboard/authoring UX phase — should be prototyped and validated (even informally) against a non-technical user persona before backend work is considered "feature complete," since this is the product's stated differentiator.

---

### Pitfall 8: Scope creep into building an agent runtime instead of a registry

**What goes wrong:**
Because the product sits so close to "agents," it's tempting to add agent execution features — running skills, testing them against a live LLM in the dashboard, building a chat interface to "try" a skill, or adding orchestration/agent-management features. Each of these individually seems like small value-add, but collectively they turn Skillshare into a second, worse agent runtime, diluting focus from its actual job (curate, version, permission, distribute) and creating massive surface area (LLM provider integration, cost management, conversation state, model version pinning) that has nothing to do with the registry's core value.

**Why it happens:**
"Test this skill before publishing" feels like an obviously good idea to a reviewer, and it's a short hop from "preview how the skill would behave" to "actually run it against a real model." Once one execution feature ships, each subsequent one ("let's add a chat window", "let's let the CLI run skills too") is a smaller incremental step and harder to say no to.

**How to avoid:**
Explicit, written charter (already captured in `PROJECT.md` Out of Scope) that skill *execution* is never in scope — restate it at every phase-planning boundary. Any "preview" feature should render/lint the skill (structure, frontmatter validity, broken resource links, prompt-injection-pattern flags) rather than execute it against a live model. If reviewers need to validate behavior, that's explicitly a job for the *consumer's own* Claude Code / agent environment, not Skillshare's dashboard.

**Warning signs:**
Roadmap items mentioning "test skill in chat," "run skill," "LLM playground," or any dependency on a specific model provider's chat/completion API for anything other than optional linting assistance.

**Phase to address:**
Should be a standing guardrail checked at every phase-planning/roadmap review, not a single phase — flag explicitly in ROADMAP.md as an anti-goal so future contributors don't drift into it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Global `role` field instead of per-workspace role table | Faster MVP schema | Cross-workspace confidentiality leak once >1 workspace is real | Never — this is a legal-content confidentiality product |
| Skip content-hash/immutability on published versions | Simpler CRUD | Cannot prove which instructions an agent followed at a point in time; breaks audit trail | Never for published versions; acceptable for drafts only |
| No script/resource scanning on publish | Faster review pipeline to build | Malicious bundled script ships to every subscribed agent | Acceptable only if v1 explicitly disallows bundled executable scripts (markdown/resources-only) |
| Single shared auth code path deferred (REST built first, MCP/CLI copy-pasted later) | Ship REST API faster | Auth logic drifts between REST/CLI/MCP, creating inconsistent enforcement | Never — build the authorization module once, shared by all three from the start |
| `latest` Docker image tag in shipped compose file | Simpler docs, "always up to date" | Non-reproducible deployments, impossible rollback | Never in a released compose file; fine only in a `:dev` internal build script |
| Raw markdown/YAML editor in dashboard v1 | Fast to build (no custom UI) | Reintroduces the "needs a developer" problem the product exists to solve | Acceptable only as an *additional* "advanced/raw" toggle for technical editors, never the only mode |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| MCP server (client agents) | Shipping without authentication "for local dev convenience," or trusting client-supplied workspace context | Require token auth even in default docker-compose profile; derive workspace/permission scope server-side from the verified token only |
| CLI sync (`skillshare` → `.claude/skills/`) | Overwriting local skill files without a clear "these are managed, don't hand-edit" convention, or silently overwriting a user's local uncommitted changes | Namespace/mark synced skill directories as managed (e.g., a `.skillshare-managed` marker + content hash) and warn/refuse on local drift rather than silently clobbering |
| REST API version/update checks | Building a "check for updates" endpoint that returns full content instead of a lightweight hash/version comparison, wasting bandwidth and creating unnecessary content exposure on every poll | Version/update-check endpoint returns only version number + content hash; full content fetch is a separate, permission-checked call |
| Agent Skills / SKILL.md ecosystem compatibility | Diverging from the upstream SKILL.md spec with proprietary extensions that break compatibility with Claude Code / Claude.ai | Track the open Agent Skills spec directly; any Skillshare-specific metadata (workspace, review status) lives outside the distributed SKILL.md content, not as spec-breaking custom frontmatter fields |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| CLI sync polls full skill list + content on every run | Slow syncs, unnecessary DB/API load, unnecessary content exposure logged | Use lightweight version/hash-based diff endpoint (see Integration Gotchas) so sync only fetches changed skill content | Noticeable once workspace has dozens of skills or many agents sync frequently |
| Storing full skill content + resources directly in relational DB rows without an object-storage layer | DB bloat, slow backups, slow version history queries | Store binary/large resource files in object storage (or filesystem volume) keyed by content hash; DB holds metadata + pointers | Once resource files (attachments) become common, not just text-only skills |
| No pagination/streaming on the "list all skills a token can access" endpoint | Slow dashboard/CLI response as workspaces/skills grow | Paginate from day one, even if current dataset is small | Becomes visible once a workspace accumulates 100+ skills or an org has many workspaces |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating skill content review as a security review substitute | Prompt-injection payloads ship to production agents despite "passing review" (reviewer read for legal correctness only) | Separate, tooling-assisted injection/scan pass distinct from legal-content review (see Pitfall 2) |
| No workspace isolation test suite | Silent cross-workspace data leaks go undetected until reported by a customer | Automated tests that assert cross-workspace/cross-tenant access always fails, run in CI on every PR touching auth/permission code |
| Trusting `latest` label to mean "reviewed/approved" without also checking status field server-side | A client bug or malicious client could request an unapproved draft version by ID even though the UI implies only approved content is served | Server-side enforcement: unauthenticated/consumer-scoped tokens can only ever resolve to `published` status content, regardless of what version ID is requested |
| Logging full skill content in application/error logs | Confidential legal content leaks into log aggregation systems (which often have broader internal access than the app itself) | Log skill IDs/hashes/metadata only, never full content, in application logs |
| Single super-admin account with no MFA/rotation story | One compromised admin account can poison every skill across every workspace | Require MFA (or clearly document as a v1 gap) for Admin role at minimum; audit-log every admin action |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No clear indication of which version an agent is currently running vs. latest approved | Legal team can't answer "was this agent using the current policy?" during an audit/incident | Surface version + content hash in CLI/MCP output and dashboard "who's on what version" view |
| Review queue with no diff view (reviewer re-reads entire skill from scratch every time) | Reviewer fatigue leads to rubber-stamp approvals, defeating the four-eyes principle | Word/line-level diff between draft and last-published version, with injection-relevant elements (links, comments) highlighted |
| Token generation flow that shows the secret once with no re-copy option and no naming/labeling step | Users either lose tokens (regenerate → churn) or paste unlabeled tokens into insecure notes to avoid losing them | Require a label/purpose at creation, allow safe management (revoke/rotate) without ever re-displaying the secret |
| Workspace picker that silently defaults to "all workspaces" or the wrong one | Editors accidentally create/edit content in the wrong practice area | Explicit workspace context always visible in the UI chrome; no implicit "current workspace" state that can drift unnoticed |

## "Looks Done But Isn't" Checklist

- [ ] **Version history / rollback:** Often missing true content immutability — verify published versions cannot be mutated in place, and rollback creates a new version rather than rewriting history.
- [ ] **Permission model:** Often missing workspace-scoping on roles/tokens — verify every role and token grant is bound to specific workspace(s), not global by default.
- [ ] **Docker Compose "out of the box" deployment:** Often missing a tested upgrade path — verify `docker compose up` works not just on a fresh volume but also after pulling a new image version against existing data.
- [ ] **MCP server:** Often missing authentication entirely in default/dev config — verify no deployment profile (including local dev) serves skill content without a valid, workspace-scoped token.
- [ ] **Draft → Review → Publish workflow:** Often missing an actual diff/injection-aware review surface — verify reviewers see more than rendered markdown (hidden comments, unicode tricks, added URLs are surfaced).
- [ ] **API keys:** Often missing lifecycle management — verify tokens can be listed, labeled, scoped, expired, and revoked individually from the dashboard, with last-used tracking.
- [ ] **CLI sync:** Often missing local-drift detection — verify sync doesn't silently overwrite locally-modified files without warning.
- [ ] **Dashboard authoring UX:** Often missing live preview and structured metadata fields — verify a non-technical user can author/edit a skill without hand-writing YAML frontmatter.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Global (non-workspace-scoped) role model shipped | HIGH | Requires a data migration (backfill workspace_id for every existing role grant, likely defaulting to "all workspaces" then requiring manual admin re-grant per workspace) plus a forced re-audit of who has access to what before flipping enforcement on |
| Mutable published versions shipped | MEDIUM | Retrofit content hashing on all historical versions, freeze future in-place edits, migrate any existing "edit in place" UI flows to fork-a-new-draft; requires a one-time data audit of whether any content actually drifted silently in the past |
| No token lifecycle management shipped | LOW-MEDIUM | Add expiry/labeling/revocation UI and a "last used" tracking column; force a one-time re-issuance of all existing unscoped tokens with new scoped ones and a sunset date for old ones |
| No MCP authentication shipped | MEDIUM | Requires a breaking change for all existing MCP consumers (must add a step to obtain and configure a token) — coordinate a deprecation window and clear migration doc before flipping enforcement on |
| Docker Compose upgrade path never tested/broken | LOW-MEDIUM | Write and test a documented migration/upgrade script retroactively against representative existing installations; add upgrade testing to release CI going forward |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Mutable published versions | Core skill/versioning data model phase | Attempt to mutate a published version via API/DB directly and confirm it's rejected; confirm content hash is stable and exposed |
| SKILL.md as prompt-injection surface | Draft → Review → Publish workflow phase | Review UI test: inject a hidden HTML-comment instruction into a draft and confirm it's surfaced/flagged, not silently rendered clean |
| Unauthenticated/under-scoped MCP & REST endpoints | Permission-model phase + MCP server phase (shared auth module) | Automated test: request skill content with no token, wrong-workspace token, and expired token — all must fail; confirm REST/CLI/MCP share one auth code path |
| Global (non-workspace-scoped) roles | Permission-model/RBAC phase | Automated test: user with Editor role in Workspace A cannot read/write Workspace B skills |
| Fragile Docker Compose upgrade path | Packaging/deployment phase | CI test: fresh install on vN-1, seed data, upgrade to vN, verify data integrity and no manual intervention required |
| API key/token sprawl | Token/API-key phase (paired with permission-model phase) | Dashboard shows token list with scope, expiry, last-used; verify revoked token immediately fails on next request |
| Developer-oriented dashboard UX | Dashboard/authoring UX phase | Usability check against a non-technical persona; verify skill can be authored/published end-to-end with zero raw YAML/markdown editing required (though available as advanced option) |
| Scope creep into agent runtime | Standing guardrail — re-checked at every phase planning/roadmap review | ROADMAP.md contains an explicit anti-goal entry; any new roadmap item proposing execution/chat/playground features is flagged and requires explicit re-scoping discussion |

## Sources

- [NPM Security - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html)
- [Active Supply Chain Attack: Malicious node-ipc Versions Published to npm - StepSecurity](https://www.stepsecurity.io/blog/node-ipc-npm-supply-chain-attack)
- [Lessons from the Spring 2026 OSS Incidents: Hardening npm, pnpm, and GitHub Actions](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp)
- [Agent Skills: Real Power, Real Risk - Mondoo](https://mondoo.com/blog/agent-skills-real-power-real-risk)
- [Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale (arXiv)](https://arxiv.org/html/2601.10338v1)
- [Malicious Agent Skills in the Wild: A Large-Scale Security Empirical Study (arXiv)](https://arxiv.org/html/2602.06547v1)
- [SkillJect: Effectively Automating Skill-Based Prompt Injection for Skill-Enabled Agents (arXiv)](https://arxiv.org/pdf/2602.14211)
- [MCP Security Vulnerabilities: How to Prevent Prompt Injection and Tool Poisoning Attacks - Practical DevSecOps](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [MCP Tool Poisoning | OWASP Foundation](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)
- [MCP Security Notification: Tool Poisoning Attacks - Invariant Labs](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)
- [MCP Security: Risks, Best Practices, and Security Controls - Checkmarx](https://checkmarx.com/learn/mcp-security-risks-real-world-incidents-and-security-controls/)
- [Stop Misusing Docker Compose in Production: What Most Teams Get Wrong - dFlow](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong)
- [Mastering PostgreSQL Docker Compose for Dev & Prod - Econumo](https://econumo.com/posts/postgresql-docker-compose/)
- [Upgrade guide - Twenty Documentation](https://docs.twenty.com/developers/self-host/capabilities/upgrade-guide)
- [API Key Management: Risks & Best Practices - Akeyless](https://www.akeyless.io/blog/power-of-api-keys/)
- [What breaks when API credentials are too broadly scoped? - NHIMG](https://nhimg.org/faq/what-breaks-when-api-credentials-are-too-broadly-scoped/)
- [How to Become Great at API Key Rotation - GitGuardian](https://blog.gitguardian.com/api-key-rotation-best-practices/)
- [Internal Developer Portals — Backstage vs Port - Medium/Callibrity](https://medium.com/callibrity/internal-developer-portals-backstage-vs-port-do-you-really-need-one-d312d8f2797e)
- [Internal developer portals aren't a silver bullet for platform engineering - Gitpod](https://www.gitpod.io/blog/internal-developer-portals-not-a-silver-bullet)
- [The Legal Side of Open Source | Open Source Guides](https://opensource.guide/legal/)
- [Starting an Open Source Project | Open Source Guides](https://opensource.guide/starting-a-project/)
- [Avoiding bad practices in open source project management - Opensource.com](https://opensource.com/business/16/6/bad-practice-foss-projects-management)
- [How to design an RBAC model for multi-tenant SaaS - WorkOS](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)
- [Multi-tenant SaaS authentication still breaks at tenant boundaries - NHIMG](https://nhimg.org/articles/multi-tenant-saas-authentication-still-breaks-at-tenant-boundaries/)
- [5 Common Errors in Content Approval Processes - Informait](https://informait.com/news/5-common-errors-in-content-approval-processes-and-how-to-avoid-them)
- [Why content approval workflows matter - Kontent.ai](https://kontent.ai/blog/content-approval-workflows/)
- [Chrome Web Store review process - Chrome for Developers](https://developer.chrome.com/docs/webstore/review-process)
- [Security and Trust in Visual Studio Marketplace - Microsoft](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace/)
- [Developers Are Victims Too: A Comprehensive Analysis of The VS Code Extension Ecosystem (arXiv)](https://arxiv.org/html/2411.07479v1)
- [How to Handle Database Migration / Schema Change? - Bytebase](https://www.bytebase.com/blog/how-to-handle-database-schema-change/)
- [Schema migrations: pitfalls and risks - Quesma](https://quesma.com/blog/schema-migrations/)
- [Upgrading Self-Hosted Supabase: A Complete Version Migration Guide](https://www.supascale.app/blog/upgrading-selfhosted-supabase-a-complete-version-migration-g)

---
*Pitfalls research for: self-hosted AI agent skill registry/hub (Skillshare)*
*Researched: 2026-07-19*
