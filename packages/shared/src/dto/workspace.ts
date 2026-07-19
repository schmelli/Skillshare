import { z } from "zod";

// Public create-workspace DTO. Deliberately name-only — no tenantId/role
// field from the client. The caller's tenant is always the server's single
// seeded Tenant, and the creator is always server-assigned the `admin` role
// for the workspace they create; accepting either from the client would be a
// mass-assignment privilege-escalation vector (RESEARCH.md Pitfall 4,
// threat T-04-02).
export const createWorkspaceDto = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required.")
    .max(255, "Workspace name is too long."),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceDto>;
