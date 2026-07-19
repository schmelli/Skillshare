import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// Workspace create + list behavioral contract (ORG-01, and the list-scoping
// half of ORG-03): an authenticated user creates a workspace and is
// server-side assigned the `admin` role for it (never a client-supplied
// field); every user's list is scoped to their own memberships only. RED
// until Task 2 mounts WorkspacesModule.
const TEST_ORIGIN = "http://localhost:5173";

describe("Workspaces (e2e)", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

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

    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    // Truncate everything this suite creates between tests (children before
    // parents to satisfy FK constraints); the seeded bootstrap Tenant is
    // never touched.
    await prisma.$transaction([
      prisma.membership.deleteMany(),
      prisma.workspace.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Registers + logs in a fresh user, returning a cookie-bearing supertest agent. */
  async function registerAndLogin(emailPrefix: string) {
    const email = `${emailPrefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const password = "Correct-Horse-Battery-Staple-1";
    const agent = request.agent(app.getHttpServer());

    await agent
      .post("/api/auth/sign-up/email")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password, name: "Test User" })
      .expect(200);

    await agent
      .post("/api/auth/sign-in/email")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password })
      .expect(200);

    return { agent, email };
  }

  it("lets an authenticated user create a workspace and see it in their own list, as admin", async () => {
    const { agent } = await registerAndLogin("admin");

    const createRes = await agent
      .post("/api/workspaces")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "Employment Law" });
    expect(createRes.status).toBe(200);
    expect(createRes.body).toMatchObject({
      name: "Employment Law",
      role: "admin",
    });

    const listRes = await agent.get("/api/workspaces");
    expect(listRes.status).toBe(200);
    expect(listRes.body.workspaces).toHaveLength(1);
    expect(listRes.body.workspaces[0]).toMatchObject({
      name: "Employment Law",
      role: "admin",
    });
  });

  it("never includes a workspace the caller has no membership in (ORG-03 non-leak, empty state)", async () => {
    const { agent: ownerAgent } = await registerAndLogin("owner");
    await ownerAgent
      .post("/api/workspaces")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "M&A" })
      .expect(200);

    const { agent: outsiderAgent } = await registerAndLogin("outsider");
    const listRes = await outsiderAgent.get("/api/workspaces");

    expect(listRes.status).toBe(200);
    expect(listRes.body.workspaces).toEqual([]);
    // The unauthorized workspace's name must never appear in the response
    // body, not even indirectly.
    expect(JSON.stringify(listRes.body)).not.toContain("M&A");
  });

  it("rejects a duplicate workspace name in the same tenant and creates exactly one row (idempotency)", async () => {
    const { agent } = await registerAndLogin("dup");
    const name = `Compliance-${Date.now()}`;

    await agent
      .post("/api/workspaces")
      .set("Origin", TEST_ORIGIN)
      .send({ name })
      .expect(200);
    const secondRes = await agent
      .post("/api/workspaces")
      .set("Origin", TEST_ORIGIN)
      .send({ name });

    expect(secondRes.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(secondRes.body)).toContain("already exists");

    const tenant = await prisma.tenant.findFirstOrThrow();
    const count = await prisma.workspace.count({
      where: { tenantId: tenant.id, name },
    });
    expect(count).toBe(1);
  });

  it("returns the workspace list in a stable, name-ascending order across repeated calls", async () => {
    const { agent } = await registerAndLogin("order");
    const suffix = Date.now();
    const names = [`Zeta-${suffix}`, `Alpha-${suffix}`, `Mid-${suffix}`];
    for (const name of names) {
      await agent
        .post("/api/workspaces")
        .set("Origin", TEST_ORIGIN)
        .send({ name })
        .expect(200);
    }

    const expected = [...names].sort();

    const firstRes = await agent.get("/api/workspaces");
    const secondRes = await agent.get("/api/workspaces");

    expect(
      firstRes.body.workspaces.map((w: { name: string }) => w.name),
    ).toEqual(expected);
    expect(
      secondRes.body.workspaces.map((w: { name: string }) => w.name),
    ).toEqual(expected);
  });
});
