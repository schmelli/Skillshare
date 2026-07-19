import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createWorkspaceDto } from "@skillshare/shared";
import { SessionGuard } from "../auth/session.guard";
import { WorkspacesService } from "./workspaces.service";

interface RequestWithUser extends FastifyRequest {
  user: { id: string };
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
  constructor(private readonly workspacesService: WorkspacesService) {}

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
}
