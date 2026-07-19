# Feature Research

**Domain:** Self-hosted AI agent skill registry / permission-gated content distribution platform (package-registry pattern applied to Anthropic Agent Skills / SKILL.md, first audience: corporate legal departments)
**Researched:** 2026-07-19
**Confidence:** MEDIUM

## Feature Landscape

Skillshare sits at the intersection of three product categories, each contributing a different feature expectation:

1. **Package/artifact registries** (npm, GitHub Packages, JFrog Artifactory, Sonatype Nexus) — establish the baseline for versioning, permissions, promotion, and audit that any "registry" product is expected to have.
2. **Prompt/LLM-asset management tools** (LangSmith Prompt Hub, PromptLayer) — the closest functional analogue: markdown/text-like AI assets with versioning, environments, and non-technical collaborator UX. PromptLayer explicitly frames RBAC + approval workflows + audit logs as required for "regulated environments" — the same bar legal departments will hold Skillshare to.
3. **Emerging Agent Skills ecosystem** (Anthropic's `anthropics/skills`, Agensi marketplace, Skilldex package manager/registry) — direct prior art for the SKILL.md format specifically. Skilldex (arXiv 2604.16911, published April 2026) is the most directly comparable OSS project: a package manager + registry for skill packages with format-conformance scoring, "skillset" bundling, and hierarchical scope (global/shared/project). It validates the market need but is aimed at individual developers, not enterprise governance — Skillshare's differentiation is the review/approval + workspace-permission layer Skilldex lacks.

None of the surveyed artifact registries (npm, GitHub Packages, Artifactory) have a first-class **human approval workflow** as a built-in primitive — they have promotion between repos (Artifactory, Nexus Staging) or PR-based review external to the tool (Backstage TechDocs). This is a genuine gap Skillshare's draft→review→publish workflow fills, and it's the single most important differentiator for the legal audience.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete, or (for the legal audience) unusable/non-compliant.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full version history with diff and rollback | Every artifact registry and prompt hub (npm, LangSmith commit hashes, PromptLayer immutable history) treats this as baseline; legal users need to see exactly what changed between approved versions | MEDIUM | Store every save as an immutable version row; diff can be text-diff on markdown body + structured diff on frontmatter |
| Draft → Review → Publish workflow (approval gate) | No commodity package registry has this built in (gap noted above) but it's the core value prop here; PromptLayer/regulated-environment pattern confirms this is expected once RBAC exists | MEDIUM-HIGH | Needs explicit workflow states, reviewer assignment, and enforcement that consumers only ever see "published" state |
| Role-based access control (Admin/Editor/Consumer) | Every registry surveyed (Artifactory, Nexus, GitHub Packages, LangSmith) has RBAC as foundational; non-negotiable for confidential legal content | MEDIUM | Roles scoped per-workspace, not just global |
| Workspace/namespace-based organization | Artifactory Projects, npm scopes (@scope/pkg), GitHub Packages org-level visibility all confirm namespacing-as-permission-boundary is standard | MEDIUM | Maps 1:1 to legal practice areas per PROJECT.md |
| Immutable, tamper-resistant audit log | Every compliance-adjacent product (Artifactory Audit Trail, Nexus audit log, dotCMS workflow logging) treats this as mandatory; legal/compliance frameworks (SOX, HIPAA-style patterns) require it | MEDIUM | Append-only log of who/what/when/action; must survive even admin actions (no retroactive edit) |
| Scoped API keys / personal access tokens | Universal pattern (npm tokens, GitHub PATs, Artifactory API keys) — access is always via a scoped credential, never shared passwords | LOW-MEDIUM | Scope to workspace(s)/skill(s), not blanket account access |
| Token expiry and revocation | Confirmed best practice across every source (90-day rotation norms, immediate revoke on compromise/offboarding) | LOW | Must-have for a legal department's security posture, not optional |
| Search and browse/discovery of skills | Every registry (npm search, Artifactory browse, GitHub Packages listing) and every prompt hub has this; without it a "hub" is just a file dump | LOW-MEDIUM | Search by name/tag/workspace/description; full-text on SKILL.md body is a stretch differentiator |
| Markdown editor with metadata (frontmatter) fields | LangSmith Playground, PromptLayer's visual editing, and the general 2026 consensus (hybrid WYSIWYG/Markdown editors) all confirm non-technical users need an editor that isn't raw file editing | MEDIUM-HIGH | This is the highest-risk table-stake feature for the legal audience — see Differentiators below |
| Deprecation / archival of a skill version | npm's `deprecate` command and version lifecycle patterns are standard; legal skills go stale (law changes) and must be flaggable without deleting history | LOW | Warn agents pulling a deprecated skill; don't hard-delete |
| REST API for listing/pulling with version awareness | Baseline for any registry-to-client integration (npm registry API, Artifactory REST API) | MEDIUM | Must support "give me latest approved version" and "check for update" semantics |
| CLI sync tool | Direct analogue to `npm install`, Skilldex's `spm` CLI; agents/humans need a scriptable pull mechanism | MEDIUM | Pulls into local skills directory (e.g. `.claude/skills/`) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for a bare registry, but valuable — especially for winning the non-technical legal audience over developer-first alternatives (Skilldex, raw git repos, Anthropic's own repo).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Non-technical-friendly markdown editor (rich-text-over-markdown, no git/terminal exposure) | The single biggest gap between Skillshare and every existing skill-package tool (all are CLI/git-first, built for developers); 2026 industry consensus favors hybrid WYSIWYG editors (e.g. CKEditor-style) that serialize to clean markdown for exactly this "legal/marketing/product" persona | HIGH | This is the make-or-break UX bet named in PROJECT.md ("no git knowledge required") — invest here over polish elsewhere |
| Reviewer workflow with inline comments/redlines on skill drafts | PromptLayer's threaded comments on prompt versions is the closest analogue and is explicitly framed as enabling "domain experts... non-technical stakeholders"; legal reviewers expect redline/comment UX (familiar from Word) | MEDIUM-HIGH | Could piggyback on the diff view; comment threads per version |
| Workspace-scoped usage analytics (who/what agent is pulling which skill, staleness detection) | Confirmed gap in commodity registries — npm and Artifactory both rely on bolted-on third-party tools for this; admins (legal ops) want to know which teams are actually using which skills and which are going stale | MEDIUM | High value for legal ops proving compliance ("everyone is using the current AML policy skill") and for pruning unused skills |
| Skill dependency/bundling ("skillsets") — related skills shipped with shared context | Skilldex's core differentiating idea (skillset abstraction, shared assets for coherence) — legal practice areas often need bundles (e.g. "M&A Due Diligence" = 5 related skills) | MEDIUM-HIGH | Defer past v1 unless a concrete workspace use case demands it — track as an explicit v2 candidate, not a v1 build |
| MCP server for runtime discovery | Already in scope per PROJECT.md; differentiator relative to plain REST/CLI registries (npm/Artifactory have neither); matches Skilldex's own MCP server, so it's now close to expected in this specific niche rather than a pure differentiator | MEDIUM | Positions Skillshare for "agent discovers and loads at runtime" workflows, not just static sync |
| Format-conformance validation for SKILL.md on save/publish | Skilldex's "compiler-style scoring against Anthropic's spec" is a novel idea worth borrowing at a lighter weight — catch malformed frontmatter/oversized descriptions before publish | LOW-MEDIUM | Cheap to build (schema + lint rules), meaningfully raises perceived quality bar |
| Environment/label promotion (e.g. "pilot" vs "org-wide" rollout tags) | LangSmith's Environments (staging/production mapped to commits) is a pattern legal departments could reuse for staged skill rollout (pilot team → full department) | MEDIUM | Not urgent for v1; note as natural v1.x extension of the existing draft→review→publish states |
| Compliance-oriented export/reporting (e.g. "who approved this skill and when" report) | ECM research shows legal/compliance buyers specifically need audit *reports*, not just raw logs, to pass internal/external review | LOW-MEDIUM | Thin reporting layer over the existing audit log; high perceived value for the legal buyer persona at low build cost |
| Import from existing skill sources (Anthropic's repo, local `.claude/skills/` folders, git repos) | Lowers adoption friction — legal teams likely already have some skills authored ad hoc by early adopters before central rollout | MEDIUM | Bulk-import + convert-to-managed-skill flow |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific product and audience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Public/cross-org marketplace (à la Agensi) | "Wouldn't it be great if other companies could share/sell skills too?" | Explicitly out of scope per PROJECT.md (single-organization v1); legal content is confidential by nature — a marketplace model is actively hostile to the target buyer's core requirement | Keep single-tenant; revisit multi-org distribution only if a genuine cross-org demand emerges post-v1 |
| Git-based authoring as the primary UX (commit/push/PR model) | Developers on the team will suggest "just use git, it's what Skilldex/Backstage TechDocs/npm all do" | Directly contradicts the stated constraint that lawyers must never touch git or a terminal; git-first is why Skilldex and TechDocs are developer tools, not legal-department tools | Web dashboard as primary authoring surface; git (if used at all) stays an internal implementation/storage detail, never exposed |
| Real-time collaborative co-editing (Google-Docs-style simultaneous editing) | Feels like table stakes because Word/Docs users expect it | High implementation complexity (OT/CRDT) for a workflow that's fundamentally sequential (draft → review → approve), not simultaneous; none of the surveyed registry/prompt-hub products have it | Optimistic locking + comment threads on a version is sufficient; simultaneous editing isn't how legal review actually works (redline-then-approve, not live co-authoring) |
| Full SSO/OIDC enterprise identity integration in v1 | "Enterprise buyers always ask for SSO" | Explicitly deferred to v2 per PROJECT.md; building it now delays the core workflow (draft/review/publish + token distribution) that validates the product | Ship API keys + role model first; design the auth layer so SSO can be added later without a rewrite |
| Skill *execution*/sandboxed running of skills in-app | "If we're distributing skills, why not let admins test-run them here too?" | Explicitly out of scope per PROJECT.md — Skillshare manages/distributes, it does not run agents; building an execution sandbox is a huge, unrelated engineering investment (security, compute, agent runtime compatibility) | Provide a read-only preview/render of the SKILL.md content and a "copy to test in your own agent" flow instead |
| Elaborate build-promotion pipeline mirroring Artifactory/Nexus staging repos | Developers on the team will want to reuse familiar CI/CD-style promotion concepts | Over-engineered for the actual need — legal review is a single approval gate (draft→review→publish), not a multi-stage build pipeline with checksum validation and replication | Keep the three-state workflow simple; add environment labels (see Differentiators) only if a real multi-stage rollout need appears |
| Automatic/AI-generated skill content or auto-approval | "Let AI draft and approve skills to save reviewer time" | Undermines the core value proposition (four-eyes principle, single source of *approved* truth) and is a compliance liability for legal content — an unreviewed AI-authored legal skill defeats the entire premise of the product | AI-assisted drafting suggestions are fine as an editor aid, but publish must always require a human reviewer's explicit approval |

## Feature Dependencies

```
Skill storage in SKILL.md format
    └──requires──> Markdown editor with metadata fields
                       └──requires──> Format-conformance validation (nice-to-have, not blocking)

Draft → Review → Publish workflow
    └──requires──> Version history with diff/rollback
    └──requires──> Roles (Admin/Editor/Consumer)
                       └──requires──> Workspace-based organization & permissions

Audit log
    └──requires──> Draft → Review → Publish workflow (needs workflow-state transitions to log)
    └──requires──> Roles (needs actor identity to log)

REST API / CLI sync / MCP server
    └──requires──> Scoped API keys / tokens
    └──requires──> Roles + workspace permissions (enforced on every pull)
    └──requires──> Draft → Review → Publish workflow (consumers must only ever see "published" state)

Usage analytics ──enhances──> Audit log (same event stream, different presentation)
Compliance export/reporting ──enhances──> Audit log (report is a view over the log, not new data)
Import from existing sources ──enhances──> Markdown editor (imported content still needs review/edit before publish)

Reviewer comments/redlines ──enhances──> Draft → Review → Publish workflow
Environment/label promotion ──enhances──> Draft → Review → Publish workflow (adds intermediate states)
Skillsets/bundling ──enhances──> Workspace-based organization (bundles live within/across workspaces)

Public marketplace ──conflicts──> Workspace-based permissions (single-org confidentiality model)
Git-based authoring UX ──conflicts──> Non-technical markdown editor (mutually exclusive as *primary* surface)
```

### Dependency Notes

- **Draft → Review → Publish requires version history:** a reviewer must be able to diff the draft against the currently-published version before approving; without diff/rollback, review is blind.
- **Draft → Review → Publish requires roles:** "review" is meaningless without a distinct Editor (drafts) vs. reviewer/Admin (approves) role — enforce that an editor cannot self-approve their own draft (four-eyes principle from PROJECT.md).
- **REST API / CLI / MCP all require the publish workflow to be enforced at the data layer, not just the UI:** if any pull path can fetch a draft/unreviewed version, the core value proposition ("agents always get the approved version") breaks. This must be a database/query-level guarantee, not a UI-only restriction.
- **Audit log requires roles and workflow states to exist first:** it has nothing meaningful to log until there are distinct actors and state transitions — sequence it after those, not before.
- **Usage analytics and compliance reporting are views over the audit log, not separate subsystems:** design the audit log schema (actor, action, resource, timestamp, workspace) early so both can be built cheaply later without a data-model migration.
- **Non-technical editor conflicts with git-based authoring as the *primary* UX:** internal storage can still use git/version-control primitives, but the moment "commit," "branch," or "PR" appears in the lawyer-facing UI, the core usability requirement is violated. Keep git-like mechanics entirely server-side if used at all.
- **Skillsets/bundling depends on workspace organization existing first**, and is explicitly deferred — don't let it creep into v1 scope just because Skilldex has it; the legal-department differentiator is governance, not bundling.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the core value proposition (permission-gated distribution of *approved* skills).

- [ ] SKILL.md storage with attached resources — the product has no reason to exist without this
- [ ] Web dashboard markdown editor with frontmatter/metadata fields — non-technical authoring is the core usability bet
- [ ] Draft → Review → Publish workflow (four-eyes) — the core differentiator vs. every existing registry
- [ ] Version history with diff and rollback — required for review to be meaningful and for legal audit expectations
- [ ] Workspaces as organizing/permission unit — legal practice-area structure is fundamental, not addable later
- [ ] Roles (Admin/Editor/Consumer) scoped per workspace — permission-gating is named in the core value prop
- [ ] Scoped API keys/tokens with expiry and revocation — agents cannot access anything without this
- [ ] REST API for listing/pulling with version-awareness — the distribution mechanism
- [ ] CLI sync tool — named explicitly in PROJECT.md as v1 scope
- [ ] MCP server for runtime discovery — named explicitly in PROJECT.md as v1 scope
- [ ] Basic audit log (who did what, when, to which skill/workspace) — legal buyers will ask "can you prove who approved this" on day one, not later
- [ ] Search/browse of skills within permitted workspaces — without this, "hub" is just a file dump

### Add After Validation (v1.x)

Features to add once the core draft/review/publish/distribute loop is proven with real legal users.

- [ ] Reviewer inline comments/redlines on drafts — add once basic review is validated and reviewers ask for richer feedback than approve/reject
- [ ] Usage analytics dashboard (who's pulling what, staleness detection) — add once there's enough real usage volume for the data to be meaningful
- [ ] Compliance export/reporting (approval history report) — add when a specific compliance/audit event (e.g. internal audit request) creates real demand
- [ ] Format-conformance validation/linting on save — nice quality-of-life addition once the core editor is stable
- [ ] Import from existing skill sources (git repos, local folders) — add once there's a real backlog of ad hoc skills to migrate
- [ ] Deprecation/archival flow for stale skills — add once the skill library is large enough that staleness becomes a visible problem

### Future Consideration (v2+)

Features to defer until product-market fit within the legal-department niche is established.

- [ ] SSO/OIDC (Entra ID, Okta) — explicitly deferred per PROJECT.md; large enterprise IT requirement but not needed to validate the core loop
- [ ] Environment/label promotion (pilot vs. org-wide rollout tags) — defer until a workspace has a concrete staged-rollout need beyond simple draft/review/publish
- [ ] Skillsets/bundling (related skills with shared context) — defer until a specific workspace demonstrates a bundling need; don't build speculatively just because Skilldex has it
- [ ] Cloud/SaaS multi-tenant hosting — explicitly deferred per PROJECT.md; architecture should stay cloud-ready but the product ships self-hosted first
- [ ] Cross-org marketplace/sharing — explicitly out of scope; revisit only if genuine cross-organization demand emerges

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Draft → Review → Publish workflow | HIGH | MEDIUM-HIGH | P1 |
| Non-technical markdown editor | HIGH | HIGH | P1 |
| Version history + diff/rollback | HIGH | MEDIUM | P1 |
| Workspaces + RBAC | HIGH | MEDIUM | P1 |
| Scoped tokens (expiry/revocation) | HIGH | LOW-MEDIUM | P1 |
| REST API + CLI sync | HIGH | MEDIUM | P1 |
| MCP server | MEDIUM-HIGH | MEDIUM | P1 |
| Basic audit log | HIGH | MEDIUM | P1 |
| Search/browse | MEDIUM | LOW-MEDIUM | P1 |
| Reviewer comments/redlines | MEDIUM | MEDIUM-HIGH | P2 |
| Usage analytics | MEDIUM | MEDIUM | P2 |
| Compliance export/reporting | MEDIUM-HIGH (for legal buyer) | LOW-MEDIUM | P2 |
| Format-conformance validation | LOW-MEDIUM | LOW-MEDIUM | P2 |
| Import from existing sources | MEDIUM | MEDIUM | P2 |
| Deprecation/archival flow | LOW-MEDIUM | LOW | P2 |
| SSO/OIDC | HIGH (long-term enterprise) | HIGH | P3 |
| Environment/label promotion | LOW-MEDIUM | MEDIUM | P3 |
| Skillsets/bundling | MEDIUM (niche) | MEDIUM-HIGH | P3 |
| Cloud/SaaS multi-tenant | MEDIUM (long-term) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | npm / GitHub Packages | JFrog Artifactory / Sonatype Nexus | LangSmith Prompt Hub / PromptLayer | Skilldex (skill-specific prior art) | Our Approach |
|---------|------------------------|--------------------------------------|--------------------------------------|--------------------------------------|--------------|
| Approval workflow before publish | None (immutable publish, deprecate after the fact) | Promotion between repos (Nexus Staging closest to a gate), not a reviewer sign-off UI | PromptLayer explicitly calls out approval workflows as needed for regulated environments; not shown as fully built-in | None (single-author CLI tool, no review concept) | Build it as the core primitive — draft→review→publish enforced at the API layer |
| Non-technical editor UX | None — CLI/git only | None — CLI/API/UI is ops-focused | LangSmith Playground and PromptLayer visual editor are the closest analogues, aimed at prompt engineers, not legal users | None — CLI tool (`spm`), git-native | Purpose-built markdown-with-metadata editor for lawyers, no git/terminal exposure |
| Versioning | Yes, immutable, SemVer | Yes, plus promotion between lifecycle stages | Yes, commit-hash + tags + environments | Yes (via git under the hood) | Yes, with diff view surfaced in the reviewer UI, not just a version list |
| RBAC / permissions | Org/team-scoped (GitHub Packages), scopes (npm) | Strong: custom roles, Projects, permission targets | Owner-only mode; less granular than artifact registries | Local scope tiers (global/shared/project), not multi-user permissioning | Workspace-scoped roles (Admin/Editor/Consumer) purpose-built for legal practice-area structure |
| Audit log | Minimal (npm), package-level metadata (GitHub) | Strong (Artifactory Audit Trail, Nexus audit log) | Implied as part of "regulated environment" positioning, not detailed | None found | Immutable, append-only, workflow-state-aware audit log from day one |
| Usage analytics | Third-party only (npm-stat, PackFolio) | Built-in operational analytics + Sumo Logic integration | Token usage/cost shown in Playground | None found | v1.x: per-skill/per-consumer pull tracking as an admin differentiator |
| Distribution mechanism | Package manager CLI (npm install) | REST API, CLI, build-tool integration | API pull, SDK | CLI (`spm`) + MCP server | REST API + CLI sync + MCP server (matches Skilldex's breadth, adds the permission-gated distribution Skilldex lacks) |
| Marketplace/discovery beyond own org | npm public registry, GitHub Packages (public option) | Internal only | Internal only | Metadata-only community registry (public) | Explicitly single-organization in v1 — no cross-org marketplace |

## Sources

- [npm Unpublish Policy](https://docs.npmjs.com/policies/unpublish/) — MEDIUM confidence
- [npm-unpublish CLI docs](https://docs.npmjs.com/cli/unpublish/) — MEDIUM confidence
- [NPM registry internals — Packagecloud Blog](https://blog.packagecloud.io/npm-registry-internals/) — MEDIUM confidence
- [JFrog Artifactory Audit Trail Log](https://docs.jfrog.com/administration/docs/audit-trail-log) — MEDIUM confidence
- [JFrog Artifactory Permissions](https://docs.jfrog.com/administration/docs/permissions) — MEDIUM confidence
- [JFrog RBAC overview](https://jfrog.com/learn/devsecops/rbac-role-based-access-control/) — MEDIUM confidence
- [JFrog Project Roles and Members](https://jfrog.com/help/r/jfrog-platform-administration-documentation/manage-project-roles-and-members) — MEDIUM confidence
- [Sonatype Nexus Repository Pro features](https://help.sonatype.com/repomanager3/product-information/repository-manager-pro-features) — MEDIUM confidence
- [Sonatype Nexus Access Control](https://help.sonatype.com/en/access-control.html) — MEDIUM confidence
- [LangSmith Manage Prompts docs](https://docs.langchain.com/langsmith/manage-prompts) — MEDIUM confidence
- [LangChain Changelog: Prompt tags in LangSmith](https://changelog.langchain.com/announcements/prompt-tags-in-langsmith-for-version-control) — MEDIUM confidence
- [What Is LangSmith Prompt Hub — C# Corner](https://www.c-sharpcorner.com/article/what-is-langsmith-prompt-hub-and-how-to-use-it-to-create-version-and-share-pro/) — MEDIUM confidence
- [PromptLayer Prompt Registry Overview](https://docs.promptlayer.com/features/prompt-registry/overview) — MEDIUM confidence
- [Top 3 LLM Prompt Versioning Platforms 2026 — MLflow](https://mlflow.org/articles/top-llm-prompt-versioning-platforms-3/) — MEDIUM confidence
- [Best Prompt Versioning Tools 2026 — Braintrust](https://www.braintrust.dev/articles/best-prompt-versioning-tools-2025) — MEDIUM confidence
- [Skilldex: A Package Manager and Registry for Agent Skill Packages (arXiv 2604.16911)](https://arxiv.org/abs/2604.16911) — MEDIUM confidence
- [7 AI Agent Skills Marketplaces in 2026 — Agensi](https://www.agensi.io/learn/best-ai-agent-skills-marketplaces-2026) — MEDIUM confidence
- [anthropics/skills GitHub](https://github.com/anthropics/skills) — MEDIUM confidence
- [Equipping agents for the real world with Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — MEDIUM confidence
- [The Agent Skills Ecosystem in 2026 — Agentman Blog](https://agentman.ai/blog/agent-skills-ecosystem-report-2026) — MEDIUM confidence
- [GitHub Packages: access control and visibility docs](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility) — MEDIUM confidence
- [GitHub Packages: permissions docs](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) — MEDIUM confidence
- [Contentful: Audit logging for enterprise-scale content platforms](https://www.contentful.com/blog/audit-logging-for-enterprise-scale-content-platforms/) — MEDIUM confidence
- [dotCMS: How Compliance-Led Organizations Track What's Live, Approved, and Performing](https://www.dotcms.com/blog/how-compliance-led-organizations-track-whats-live-approved-and-performing) — MEDIUM confidence
- [dotCMS: What CMS Features Are Required to Pass Internal Audits and Regulatory Reviews?](https://www.dotcms.com/blog/what-cms-features-are-required-to-pass-internal-audits-and-regulatory-reviews) — MEDIUM confidence
- [API Token Security Best Practices — hoop.dev](https://hoop.dev/blog/api-token-security-best-practices-for-managing-rotating-and-protecting-your-keys) — MEDIUM confidence
- [PAT Token Management and Rotation Strategies — Grizzly Peak Software](https://www.grizzlypeaksoftware.com/library/pat-token-management-and-rotation-strategies-xjlybwrx) — MEDIUM confidence
- [API Key Rotation and Lifecycle Management — Zuplo](https://zuplo.com/learning-center/api-key-rotation-lifecycle-management) — MEDIUM confidence
- [PackFolio — npm Package Analytics Dashboard](https://www.packfolio.dev/) — MEDIUM confidence
- [npm-stat: download statistics for NPM packages](https://npm-stat.com/) — MEDIUM confidence
- [Backstage TechDocs documentation](https://backstage.io/docs/features/techdocs/) — MEDIUM confidence
- [WYSIWYG vs Markdown: Differences & How to Choose — CKEditor](https://ckeditor.com/blog/wysiwyg-vs-markdown-editor-comparison/) — MEDIUM confidence

Note: all findings sourced via general web search (no curated/official-docs MCP provider was available in this environment); confidence is capped at MEDIUM per the source-hierarchy classification for cross-checked web search findings. Claims that recurred across 2+ independent sources (e.g. "no built-in approval workflow in commodity artifact registries," "RBAC + audit log as baseline for regulated content") are treated as more reliable than single-source claims.

---
*Feature research for: self-hosted AI agent skill registry (permission-gated distribution for enterprise legal departments)*
*Researched: 2026-07-19*
