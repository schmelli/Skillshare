// The project's per-workspace role vocabulary. Defined here as the single
// source of truth, imported by both the API (Membership.role, better-auth's
// custom `createAccessControl` roles) and the web dashboard (role badges) —
// never better-auth's own default `owner`/`admin`/`member` labels
// (RESEARCH.md Pitfall 3: role strings like "member" must never leak into
// apps/web or any DTO).
export const WORKSPACE_ROLES = ["admin", "editor", "consumer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    (WORKSPACE_ROLES as readonly string[]).includes(value)
  );
}
