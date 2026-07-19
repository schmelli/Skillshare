import { z } from "zod";
import { WORKSPACE_ROLES } from "../roles";

// Admin-only role-grant DTO — deliberately separate from the public
// sign-up/create-workspace DTOs (RESEARCH.md Pitfall 4 / Security Domain
// mass-assignment prohibition: role assignment must never ride along with a
// self-service endpoint). Identifies the target by email rather than an
// internal userId: a non-technical Admin (CLAUDE.md's audience constraint)
// has no way of knowing another user's ID, and the server-side "no user
// found with that email" failure maps directly to the UI-SPEC's
// "unresolvable user" grant-error state.
export const grantRoleDto = z.object({
  targetEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),
  role: z.enum(WORKSPACE_ROLES),
});
export type GrantRoleDto = z.infer<typeof grantRoleDto>;
