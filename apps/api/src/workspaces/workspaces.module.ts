import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceRoleGuard } from "../auth/workspace-role.guard";
import { MembershipService } from "./membership.service";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [AuthModule], // for SessionGuard, exported by AuthModule
  controllers: [WorkspacesController],
  providers: [WorkspacesService, MembershipService, WorkspaceRoleGuard],
  exports: [WorkspacesService, MembershipService],
})
export class WorkspacesModule {}
