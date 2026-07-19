import { Injectable } from "@nestjs/common";
import type { WorkspaceRole } from "@skillshare/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface MembershipRecord {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface MemberListItem {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
}

export type GrantRoleResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "user-not-found" };

// The single place every per-workspace membership read/write goes through
// (RESEARCH.md Code Example: NestJS Roles decorator + WorkspaceRoleGuard
// skeleton calls `membershipService.findRole`). `WorkspaceRoleGuard` is the
// enforcement point that CALLS `findRole` on every request; this service
// owns no authorization logic of its own for reads — only `grantRole`
// re-verifies the acting user's per-workspace Admin authority, as a second
// layer beneath the guard's own `@Roles('admin')` check (defense in depth,
// not a substitute for it).
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's actual Membership row for (userId, workspaceId), or null
   * if none exists. `WorkspaceRoleGuard` treats `null` as deny-by-default —
   * never a default/downgraded role (T-05-01 IDOR mitigation).
   */
  async findRole(
    userId: string,
    workspaceId: string,
  ): Promise<MembershipRecord | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) return null;
    return {
      userId: membership.userId,
      workspaceId: membership.workspaceId,
      role: membership.role as WorkspaceRole,
    };
  }

  /**
   * All members of a workspace, name-ascending for a stable order (mirrors
   * WorkspacesService.listForUser's ordering convention). Only ever called
   * from a route already guarded by `WorkspaceRoleGuard` + `@Roles('admin')`
   * — this method itself performs no authorization check.
   */
  async listMembers(workspaceId: string): Promise<MemberListItem[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    });

    return memberships.map((membership) => ({
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role as WorkspaceRole,
    }));
  }

  /**
   * Grants (or updates) `targetEmail`'s role in `workspaceId`. Resolves the
   * target by email — the natural identifier for a non-technical Admin, who
   * has no way of knowing another user's internal ID (CLAUDE.md's
   * non-technical-audience constraint) — returning `user-not-found` when it
   * doesn't resolve (UI-SPEC's "unresolvable user" grant-error state).
   * Re-verifies `actingUserId` holds an `admin` Membership in THIS
   * workspace specifically (per-workspace authority: an Admin of workspace A
   * cannot grant roles in workspace B) as a second layer beneath the route's
   * own `WorkspaceRoleGuard` + `@Roles('admin')`. The grant itself is an
   * `upsert` on `@@unique([userId, workspaceId])`, so re-granting a role to
   * a user who already has one in this workspace UPDATES the existing row —
   * it never creates a duplicate (re-grant idempotency).
   */
  async grantRole(
    actingUserId: string,
    workspaceId: string,
    targetEmail: string,
    role: WorkspaceRole,
  ): Promise<GrantRoleResult> {
    const actingMembership = await this.findRole(actingUserId, workspaceId);
    if (!actingMembership || actingMembership.role !== "admin") {
      return { ok: false, reason: "forbidden" };
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: targetEmail },
    });
    if (!targetUser) {
      return { ok: false, reason: "user-not-found" };
    }

    await this.prisma.membership.upsert({
      where: {
        userId_workspaceId: { userId: targetUser.id, workspaceId },
      },
      create: { userId: targetUser.id, workspaceId, role },
      update: { role },
    });

    return { ok: true };
  }
}
