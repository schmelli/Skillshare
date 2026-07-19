# Skillshare

## What This Is

Skillshare is an open-source hub for centrally creating, managing, and distributing AI agent skills (Anthropic Agent Skills / SKILL.md standard) to decentralized agents. A central team curates skills through a web dashboard with a review workflow; decentralized consumers (humans and their AI agents) pull the latest approved versions via REST API, CLI sync, or MCP server — gated by access tokens and workspace permissions. The first target audience is corporate legal departments that author legal skills centrally and distribute them to distributed teams of project lawyers across a corporate group.

## Core Value

A permission-controlled single source of truth for agent skills: decentralized agents always pull the latest **approved** version of exactly the skills they are authorized to use.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Skills stored and versioned in the open SKILL.md (Agent Skills) format with attached resource files
- [ ] Web dashboard to create, edit, organize, and manage skill files (markdown editor, metadata, resources)
- [ ] Draft → Review → Publish workflow (four-eyes principle); agents only ever see approved versions
- [ ] Full version history per skill with diff and rollback
- [ ] Workspaces (e.g. "Employment Law", "M&A", "Compliance") as the unit of organization and permissioning
- [ ] Roles: Admin / Editor / Consumer, with workspace-level grants
- [ ] Agent access via personal access tokens (API keys) scoped to permitted workspaces/skills
- [ ] REST API for listing and pulling skills (with version/update check)
- [ ] CLI (`skillshare`) that syncs permitted skills into a local skills directory (e.g. `.claude/skills/`)
- [ ] MCP server endpoint so agents can discover and load permitted skills at runtime
- [ ] Out-of-the-box deployment: single `docker compose up` brings up the full stack
- [ ] Architecture is cloud-ready (later SaaS/multi-tenant operation possible without redesign)

### Out of Scope

- Cloud/SaaS hosting as primary model — self-hosted first; legal departments require data to stay in-house
- SSO/OIDC (Entra ID, Okta) in v1 — API keys + role model first; enterprise SSO is a v2 concern
- Skill *execution* or agent runtime — Skillshare manages and distributes skills; it does not run agents
- Marketplace/public skill sharing between organizations — v1 is single-organization
- Non-SKILL.md skill formats — committed to the open Agent Skills standard for ecosystem compatibility

## Context

- Fresh greenfield repository `schmelli/Skillshare` (GitHub), development happens on branch `development`
- Open-source project — license, contribution docs, and public README matter
- The Agent Skills standard (SKILL.md: YAML frontmatter + markdown instructions + optional resources/scripts) is an open Anthropic-driven format supported by Claude Code, Claude.ai, and a growing ecosystem
- Primary user story: a legal expert authors/updates a skill in the dashboard → a reviewer approves it → a project lawyer's agent (e.g. Claude Code) pulls the new version automatically via token-authenticated CLI/MCP
- Usability is a first-class requirement: non-technical legal professionals must be able to author and manage skills without touching git or a terminal
- The user has given free hand on stack and additional features that increase the solution's value

## Constraints

- **Format**: Agent Skills / SKILL.md standard — ecosystem compatibility (Claude Code, Claude.ai) is a core bet
- **Deployment**: Docker Compose self-hosted must work out of the box — target users cannot run complex infra
- **Security**: Permission checks on every skill access — legal content is confidential; unauthorized agents must never receive skill content
- **Audience**: Dashboard UX must suit non-technical users (lawyers) — no git knowledge required
- **Licensing**: Open source — dependencies must be license-compatible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SKILL.md / Agent Skills as the skill format | Open standard, direct compatibility with Claude Code & ecosystem | — Pending |
| Self-hosted Docker-first, cloud-ready architecture | Legal departments need data in-house; SaaS possible later | — Pending |
| API keys + roles (Admin/Editor/Consumer), SSO deferred | Fast to v1, covers the permission requirement; SSO is v2 | — Pending |
| Distribution via REST API + CLI sync + MCP server | Meets agents where they are: scripted pull, local sync, runtime discovery | — Pending |
| Draft → Review → Publish workflow | Four-eyes principle is essential for legal content quality | — Pending |
| Workspace-based organization & permissions | Maps to legal practice areas and corporate team structures | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-19 after initialization*
