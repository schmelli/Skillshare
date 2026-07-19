import { Injectable } from "@nestjs/common";
import type { WorkspaceRole } from "@skillshare/shared";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface WorkspaceListItem {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: Date;
}

export type CreateWorkspaceResult =
  | { ok: true; workspace: WorkspaceListItem }
  | { ok: false; conflict: true };

// Skillshare's own Tenant -> Workspace -> Membership tables (RESEARCH.md
// Pattern 3), independent of better-auth's own Organization/Member tables
// (auth.ts's `organization` plugin registration establishes the shared role
// vocabulary only — see auth.ts's comment; the actual read/write path for
// every workspace/role in this phase goes through Prisma here).
@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Workspace creation is an Admin-only, server-enforced mutation" (Plan 04
   * must_haves / threat T-04-02), reconciled with there being no separate
   * tenant-level Admin flag in the schema: the very first workspace in an
   * otherwise-empty tenant may be bootstrapped by any authenticated user
   * (there is no one else who could already be Admin of anything) — that
   * user becomes its `admin`. Once the tenant has at least one workspace,
   * only a caller who already holds an `admin` Membership in some workspace
   * may create another. The controller MUST call this before `create()`;
   * `create()` itself performs no authorization check.
   */
  async canCreateWorkspace(userId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findFirstOrThrow();
    const existingCount = await this.prisma.workspace.count({
      where: { tenantId: tenant.id },
    });
    if (existingCount === 0) {
      return true;
    }
    const adminMembership = await this.prisma.membership.findFirst({
      where: { userId, role: "admin" },
    });
    return adminMembership !== null;
  }

  /**
   * Creates a workspace under the caller's single seeded Tenant and assigns
   * the creator the `admin` role — server-derived and unconditional, never a
   * client-supplied field (RESEARCH.md Pitfall 4, threat T-04-02). Callers
   * must check `canCreateWorkspace` first; this method does not re-check
   * authorization (small TOCTOU window under concurrent creation is
   * acceptable: it only ever fails a legitimate bootstrap closed, never
   * grants unauthorized access).
   */
  async create(userId: string, name: string): Promise<CreateWorkspaceResult> {
    const tenant = await this.prisma.tenant.findFirstOrThrow();

    try {
      const workspace = await this.prisma.$transaction(async (tx) => {
        const created = await tx.workspace.create({
          data: { tenantId: tenant.id, name },
        });
        await tx.membership.create({
          data: { userId, workspaceId: created.id, role: "admin" },
        });
        return created;
      });

      return {
        ok: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          role: "admin",
          createdAt: workspace.createdAt,
        },
      };
    } catch (error) {
      // @@unique([tenantId, name]) violation -> a name conflict, not a
      // check-then-insert race (edge #4 backstop / T-04-03).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ok: false, conflict: true };
      }
      throw error;
    }
  }

  /**
   * Deny-by-default: starts from the caller's own Membership rows (never
   * `workspace.findMany()` with a client-supplied filter), so a workspace
   * the caller has no membership in can never appear in the response
   * (ORG-03). Ordered by workspace name ascending for a stable list order
   * across repeated calls (edge #8 backstop).
   */
  async listForUser(userId: string): Promise<WorkspaceListItem[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { workspace: { name: "asc" } },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role as WorkspaceRole,
      createdAt: membership.workspace.createdAt,
    }));
  }
}
