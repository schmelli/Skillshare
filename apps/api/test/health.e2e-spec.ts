import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

// Proves the thinnest Walking Skeleton slice end-to-end: NestJS/Fastify ->
// PrismaService -> Postgres, via a real `prisma.tenant.count()` read (not a
// static/mocked response). RED until Task 2 wires HealthController to Prisma.
describe("GET /api/health (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { bodyParser: false },
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with a real tenantCount read from Postgres", async () => {
    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok" });
    expect(typeof response.body.tenantCount).toBe("number");
    expect(response.body.tenantCount).toBeGreaterThanOrEqual(0);
  });
});
