import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import type { WorkspaceRole } from "@skillshare/shared";
import { MembershipService } from "../workspaces/membership.service";
import { ROLES_KEY } from "./roles.decorator";

// Generic, non-leaking permission-denied copy (UI-SPEC Copywriting
// Contract's "Error — permission denied" row). Applied identically whether
// :workspaceId refers to a real workspace the caller has no membership in,
// or one that doesn't exist at all — never echoes the workspace name, never
// confirms existence (ORG-03 non-leak prohibition / threat T-05-03).
export const WORKSPACE_ACCESS_DENIED_MESSAGE =
  "You don't have access to this workspace. Contact your admin if you think this is a mistake.";

interface RequestWithUser extends FastifyRequest {
  user: { id: string };
  params: { workspaceId?: string };
}

// The single structural per-workspace authorization enforcement point
// (RESEARCH.md Code Example / System Architecture Diagram; threat T-05-01
// IDOR mitigation): reads the caller's ACTUAL Membership row for the
// requested `:workspaceId` on every request — never trusts the ID itself,
// never grants a default/downgraded role when no membership row exists.
// Every future workspace-scoped route (skills, later phases) reuses this
// guard verbatim.
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membershipService: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const workspaceId = req.params.workspaceId;

    if (!workspaceId) {
      // Misconfiguration guard: this guard must only ever be applied to a
      // route with a :workspaceId param. Deny rather than silently allow.
      throw new ForbiddenException(WORKSPACE_ACCESS_DENIED_MESSAGE);
    }

    const membership = await this.membershipService.findRole(
      req.user.id,
      workspaceId,
    );

    // Deny-by-default: no membership row for this workspace = no access,
    // full stop — never a default/downgraded role (T-05-01). The identical
    // generic 403 below is also returned for a workspace the caller has no
    // membership in AND for one that doesn't exist, so the response can
    // never be used to enumerate real workspace IDs (T-05-03).
    if (!membership) {
      throw new ForbiddenException(WORKSPACE_ACCESS_DENIED_MESSAGE);
    }

    if (required?.length && !required.includes(membership.role)) {
      throw new ForbiddenException(WORKSPACE_ACCESS_DENIED_MESSAGE);
    }

    return true;
  }
}
