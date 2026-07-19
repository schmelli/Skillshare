import { Controller, Get } from "@nestjs/common";

@Controller("api")
export class AppController {
  // Static health response for Wave 0. A real DB-backed health read
  // (prisma.tenant.count()) is added in Plan 02 per SKELETON.md.
  @Get("health")
  health(): { status: "ok" } {
    return { status: "ok" };
  }
}
