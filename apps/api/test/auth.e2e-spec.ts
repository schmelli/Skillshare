import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// Auth behavioral contract (AUTH-01): register -> log in -> session round-trip;
// duplicate registration yields exactly one user row; invalid login is
// ambiguous about which field (email vs password) failed. RED until Task 2
// mounts better-auth's `/api/auth/*` routes via auth.handler.
describe("Auth (e2e)", () => {
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
    // Truncate the auth-owned tables between tests (children before parent
    // to satisfy FK constraints). Tenant/Workspace/Membership seed data is
    // untouched.
    await prisma.$transaction([
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers, logs in, and returns the user's email on a session-scoped request", async () => {
    const email = `happy-${Date.now()}@example.com`;
    const password = "Correct-Horse-Battery-Staple-1";
    const agent = request.agent(app.getHttpServer());

    const signUpRes = await agent
      .post("/api/auth/sign-up/email")
      .send({ email, password, name: "Test User" });
    expect(signUpRes.status).toBe(200);

    const signInRes = await agent
      .post("/api/auth/sign-in/email")
      .send({ email, password });
    expect(signInRes.status).toBe(200);
    expect(signInRes.headers["set-cookie"]).toBeDefined();

    const sessionRes = await agent.get("/api/auth/get-session");
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body?.user?.email).toBe(email);
  });

  it("rejects a duplicate registration and creates exactly one user row", async () => {
    const email = `dup-${Date.now()}@example.com`;
    const password = "Correct-Horse-Battery-Staple-1";

    const firstRes = await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({ email, password, name: "First Attempt" });
    expect(firstRes.status).toBe(200);

    const secondRes = await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({ email, password, name: "Second Attempt" });
    expect(secondRes.status).toBeGreaterThanOrEqual(400);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("gives an ambiguous error for an invalid login (does not reveal which field failed)", async () => {
    const email = `invalid-login-${Date.now()}@example.com`;
    const correctPassword = "Correct-Horse-Battery-Staple-1";
    const wrongPassword = "Totally-Wrong-Password-2";
    const nonexistentEmail = `no-such-user-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({ email, password: correctPassword, name: "Real User" });

    const wrongPasswordRes = await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email, password: wrongPassword });
    expect(wrongPasswordRes.status).toBeGreaterThanOrEqual(400);

    const wrongEmailRes = await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email: nonexistentEmail, password: wrongPassword });
    expect(wrongEmailRes.status).toBeGreaterThanOrEqual(400);

    const wrongPasswordMessage = JSON.stringify(
      wrongPasswordRes.body,
    ).toLowerCase();
    const wrongEmailMessage = JSON.stringify(wrongEmailRes.body).toLowerCase();

    // Neither error body may name which field was wrong (no "no such user" /
    // "user not found" / "incorrect password" style disclosure), and the two
    // distinct failure causes (wrong password vs. nonexistent email) must
    // produce the SAME ambiguous message — the core enumeration-hardening
    // assertion (T-03-03).
    expect(wrongPasswordMessage).not.toMatch(/user not found|no such user|no account/);
    expect(wrongEmailMessage).not.toMatch(/user not found|no such user|no account/);
    expect(wrongPasswordMessage).toBe(wrongEmailMessage);
  });
});
