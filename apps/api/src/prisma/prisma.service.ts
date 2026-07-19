import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Prisma 7 has no Rust query engine — a driver adapter is mandatory, not an
// optional performance opt-in (RESEARCH.md Pitfall 1 / Anti-Patterns).
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
