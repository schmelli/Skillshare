---
status: testing
phase: 01-foundation-access-control
source: [01-VERIFICATION.md]
started: 2026-07-19T18:19:34Z
updated: 2026-07-19T18:19:34Z
---

## Current Test

number: 1
name: docker compose up with real postgres:18 image
expected: |
  The postgres:18 container reports healthy via its `pg_isready` healthcheck
  (`docker compose ps` shows healthy), and the full register → create-workspace
  → grant-role flow works identically to how it was verified against the local
  Postgres 16 substitute (migration, seed, health read, auth, workspaces).
awaiting: user response

## Tests

### 1. docker compose up with real postgres:18 image
expected: Run `docker compose up -d postgres` on a machine with normal internet access (this sandbox's egress proxy blocks Docker Hub with a hard 403). `docker compose ps` reports the service healthy; then run `prisma migrate deploy` + seed and the full register → create-workspace → grant-role flow against it. Everything behaves identically to the local-Postgres-16 verification.
result: [pending]

### 2. Concurrent grant/revoke vs. list-read consistency
expected: With two concurrent clients, one reads a workspace's member list (or a user's own workspace list) while the other concurrently grants/revokes a role affecting the same rows. Every list read reflects either the pre-grant or post-grant state in full — never a partial/torn membership. (Structural support: atomic upsert + read-committed isolation; this test proves the timing invariant behaviorally.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
