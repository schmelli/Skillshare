import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// Role-grant + cross-workspace isolation contract (ORG-02, and the
// enforcement half of ORG-03): an Admin grants a per-workspace role; a role
// held in one workspace confers nothing in another (WorkspaceRoleGuard
// deny-by-default); cross-workspace 403s do not leak the target workspace's
// name or confirm its existence; re-granting a role upserts (never
// duplicates); a non-Admin member cannot grant roles. RED until Task 2 wires
// @Roles + WorkspaceRoleGuard + the grant endpoint.
const TEST_ORIGIN = "http://localhost:5173";

describe("Membership (e2e)", () => {
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

  async function createWorkspace(
    agent: ReturnType<typeof request.agent>,
    name: string,
  ) {
    const res = await agent
      .post("/api/workspaces")
      .set("Origin", TEST_ORIGIN)
      .send({ name })
      .expect(200);
    return res.body as { id: string; name: string };
  }

  it("lets an Admin grant a user a role in a workspace, and the user's workspace list then includes it (ORG-02)", async () => {
    const { agent: adminAgent } = await registerAndLogin("admin");
    const workspaceA = await createWorkspace(
      adminAgent,
      `Workspace A ${Date.now()}`,
    );

    const { agent: userAgent, email: userEmail } =
      await registerAndLogin("user");

    const grantRes = await adminAgent
      .post(`/api/workspaces/${workspaceA.id}/members`)
      .set("Origin", TEST_ORIGIN)
      .send({ targetEmail: userEmail, role: "editor" });
    expect(grantRes.status).toBe(200);

    const listRes = await userAgent.get("/api/workspaces");
    expect(listRes.status).toBe(200);
    expect(listRes.body.workspaces).toHaveLength(1);
    expect(listRes.body.workspaces[0]).toMatchObject({
      id: workspaceA.id,
      role: "editor",
    });
  });

  it("denies a cross-workspace request with a non-leaking 403 that does not confirm existence (ORG-03 non-leak)", async () => {
    const { agent: adminAgent } = await registerAndLogin("admin");
    const workspaceB = await createWorkspace(
      adminAgent,
      `Secret Workspace ${Date.now()}`,
    );

    const { agent: outsiderAgent } = await registerAndLogin("outsider");

    const res = await outsiderAgent.get(
      `/api/workspaces/${workspaceB.id}/members`,
    );
    expect(res.status).toBe(403);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(workspaceB.name);
    expect(body.toLowerCase()).not.toContain("secret workspace");

    // A made-up workspace ID produces the SAME generic denial shape — an
    // unauthorized-but-existing workspace and a nonexistent one must be
    // indistinguishable to the caller (edge #6 adjacency / T-05-03).
    const fakeRes = await outsiderAgent.get(
      "/api/workspaces/nonexistent-cuid-00000000/members",
    );
    expect(fakeRes.status).toBe(403);
    expect(JSON.stringify(fakeRes.body)).toEqual(body);
  });

  it("upserts a re-grant into exactly one Membership row instead of duplicating it (idempotency)", async () => {
    const { agent: adminAgent } = await registerAndLogin("admin");
    const workspaceA = await createWorkspace(
      adminAgent,
      `Workspace A ${Date.now()}`,
    );
    const { email: userEmail } = await registerAndLogin("user");

    await adminAgent
      .post(`/api/workspaces/${workspaceA.id}/members`)
      .set("Origin", TEST_ORIGIN)
      .send({ targetEmail: userEmail, role: "editor" })
      .expect(200);

    await adminAgent
      .post(`/api/workspaces/${workspaceA.id}/members`)
      .set("Origin", TEST_ORIGIN)
      .send({ targetEmail: userEmail, role: "consumer" })
      .expect(200);

    const memberships = await prisma.membership.findMany({
      where: { workspaceId: workspaceA.id },
    });
    // Exactly two rows total for this workspace (admin creator + the
    // re-granted user) — the second grant updated the existing row rather
    // than creating a duplicate.
    expect(memberships).toHaveLength(2);
    const userRows = memberships.filter((m) => m.role === "consumer");
    expect(userRows).toHaveLength(1);
  });

  it("denies a role grant attempted by a non-Admin member of the workspace", async () => {
    const { agent: adminAgent } = await registerAndLogin("admin");
    const workspaceA = await createWorkspace(
      adminAgent,
      `Workspace A ${Date.now()}`,
    );

    const { agent: editorAgent, email: editorEmail } =
      await registerAndLogin("editor");
    await adminAgent
      .post(`/api/workspaces/${workspaceA.id}/members`)
      .set("Origin", TEST_ORIGIN)
      .send({ targetEmail: editorEmail, role: "editor" })
      .expect(200);

    const { email: outsiderEmail } = await registerAndLogin("outsider2");

    const res = await editorAgent
      .post(`/api/workspaces/${workspaceA.id}/members`)
      .set("Origin", TEST_ORIGIN)
      .send({ targetEmail: outsiderEmail, role: "editor" });

    expect(res.status).toBe(403);

    const membership = await prisma.membership.findFirst({
      where: { workspaceId: workspaceA.id, user: { email: outsiderEmail } },
    });
    expect(membership).toBeNull();
  });
});
