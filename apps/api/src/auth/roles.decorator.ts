import { SetMetadata } from "@nestjs/common";
import type { WorkspaceRole } from "@skillshare/shared";

// Metadata key WorkspaceRoleGuard reads via Reflector (RESEARCH.md Code
// Examples: NestJS Roles decorator + guard skeleton). Declarative,
// structural enforcement — a route missing @Roles(...) still gets the
// deny-by-default membership check from WorkspaceRoleGuard, it just doesn't
// additionally restrict which role is required.
export const ROLES_KEY = "roles";

export const Roles = (...roles: WorkspaceRole[]) =>
  SetMetadata(ROLES_KEY, roles);
