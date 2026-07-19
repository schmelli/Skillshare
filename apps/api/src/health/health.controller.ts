import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("api")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Real DB-backed health read (real prisma.tenant.count()), replacing the
  // Wave 0 static { status: 'ok' } response from Plan 01's AppController.
  @Get("health")
  async health(): Promise<{ status: "ok"; tenantCount: number }> {
    const tenantCount = await this.prisma.tenant.count();
    return { status: "ok", tenantCount };
  }
}
