import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createWorkspaceDto, grantRoleDto } from "@skillshare/shared";
import { Roles } from "../auth/roles.decorator";
import { SessionGuard } from "../auth/session.guard";
import {
  WORKSPACE_ACCESS_DENIED_MESSAGE,
  WorkspaceRoleGuard,
} from "../auth/workspace-role.guard";
import { MembershipService } from "./membership.service";
import { WorkspacesService } from "./workspaces.service";

interface RequestWithUser extends FastifyRequest {
  user: { id: string };
  params: { workspaceId?: string };
}

// SessionGuard gates both routes. POST additionally enforces
// `canCreateWorkspace` server-side (T-04-02, must_haves: "a non-Admin cannot
// create a workspace even by calling the API directly") — see
// WorkspacesService.canCreateWorkspace for the bootstrap-vs-Admin-only rule.
// The resulting role is always `admin`, assigned to the caller, never a
// client-supplied field. The list route never accepts a filter from the
// client — it is always scoped to the caller's own memberships (ORG-03
// deny-by-default) and also reports whether the caller is currently allowed
// to create another workspace, so the dashboard can render the correct
// empty-state CTA (hiding the button is UX only, never the actual control).
@Controller("api/workspaces")
@UseGuards(SessionGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get()
  async list(@Req() req: RequestWithUser) {
    const [workspaces, canCreate] = await Promise.all([
      this.workspacesService.listForUser(req.user.id),
      this.workspacesService.canCreateWorkspace(req.user.id),
    ]);
    return { workspaces, canCreate };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Req() req: RequestWithUser, @Body() body: unknown) {
    const allowed = await this.workspacesService.canCreateWorkspace(
      req.user.id,
    );
    if (!allowed) {
      throw new ForbiddenException(
        "Only a workspace Admin can create additional workspaces. Ask an existing Admin to grant you access.",
      );
    }

    const parsed = createWorkspaceDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? "Invalid workspace name.",
      );
    }

    const result = await this.workspacesService.create(
      req.user.id,
      parsed.data.name,
    );
    if (!result.ok) {
      throw new ConflictException(
        `A workspace named '${parsed.data.name}' already exists. Choose a different name.`,
      );
    }
    return result.workspace;
  }

  // Both member routes are Admin-only per-workspace (WorkspaceRoleGuard +
  // @Roles('admin')) — even reading the member list requires the caller to
  // hold an `admin` Membership row for THIS :workspaceId specifically.
  // WorkspaceRoleGuard's deny-by-default check runs before either handler
  // body executes, so a caller with no membership (or a non-admin
  // membership) in the requested workspace never reaches this code
  // (T-05-01 IDOR mitigation, ORG-03 non-leak).
  @Get(":workspaceId/members")
  @UseGuards(WorkspaceRoleGuard)
  @Roles("admin")
  async listMembers(@Param("workspaceId") workspaceId: string) {
    return { members: await this.membershipService.listMembers(workspaceId) };
  }

  @Post(":workspaceId/members")
  @UseGuards(WorkspaceRoleGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  async grantRole(
    @Req() req: RequestWithUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ) {
    const parsed = grantRoleDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? "Invalid grant request.",
      );
    }

    const result = await this.membershipService.grantRole(
      req.user.id,
      workspaceId,
      parsed.data.targetEmail,
      parsed.data.role,
    );

    if (!result.ok) {
      if (result.reason === "user-not-found") {
        throw new BadRequestException("No user found with that email.");
      }
      // Defense-in-depth: WorkspaceRoleGuard already required `admin` in
      // this workspace, so this branch should be unreachable in practice —
      // still returns the same non-leaking denial shape, never a different
      // status/message that could hint at *why*.
      throw new ForbiddenException(WORKSPACE_ACCESS_DENIED_MESSAGE);
    }

    return { ok: true };
  }
}
