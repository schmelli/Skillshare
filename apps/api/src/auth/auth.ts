import path from "node:path";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins/organization";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// `auth.ts`'s top-level `new PrismaClient()` below runs at MODULE IMPORT
// time (CommonJS `require()` evaluates top-to-bottom, well before
// `ConfigModule.forRoot()` gets a chance to populate `process.env` during
// Nest's own bootstrap) — unlike `PrismaService`, whose `PrismaPg`
// construction happens lazily inside its constructor, at DI-instantiation
// time, after env vars are already loaded. Without this, DATABASE_URL is
// still undefined here, so the driver adapter can't connect. Same
// `process.loadEnvFile` pattern as `prisma.config.ts` / `test/setup.ts`.
try {
  process.loadEnvFile(path.join(__dirname, "..", "..", ".env"));
} catch {
  // .env is optional if DATABASE_URL/BETTER_AUTH_SECRET are already exported
  // by the environment (e.g. CI, Docker Compose `environment:`).
}

// Dedicated PrismaClient instance for better-auth's own module-level export
// (`auth`). better-auth needs `auth`/`auth.api` available outside NestJS's DI
// container (AuthController's catch-all route, SessionGuard), so it cannot be
// constructed lazily inside a NestJS provider — this mirrors RESEARCH.md's
// Code Examples pattern. A second connection pool alongside PrismaService's
// is an acceptable tradeoff at this phase's scale.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Custom admin/editor/consumer roles, defined here — before any
// controller/UI code references a role string — per RESEARCH.md Pattern 2 /
// Pitfall 3: better-auth's org plugin ships default `owner`/`admin`/`member`
// role labels, and "member" must never leak into apps/web or a DTO (threat
// T-04-04). better-auth's own `owner` role stays a purely internal
// implementation detail (RESEARCH.md Open Question 3) — every actual
// workspace/role read or write in this phase goes through Skillshare's own
// Tenant/Workspace/Membership tables (WorkspacesService, Plan 05's
// WorkspaceRoleGuard), not this plugin's own endpoints; registering it here
// establishes the shared role vocabulary and keeps better-auth's own
// organization-plugin surface (exposed alongside `/api/auth/*`) from ever
// surfacing "member" if it's reached directly.
const statement = { ...defaultStatements } as const;
const ac = createAccessControl(statement);
const adminRole = ac.newRole({ ...adminAc.statements });
const editorRole = ac.newRole({ member: ["update"] });
const consumerRole = ac.newRole({});

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  // BETTER_AUTH_SECRET / BETTER_AUTH_URL are read automatically from
  // process.env by better-auth's own config resolution; only the
  // dev-vs-prod-variable WEB_ORIGIN needs to be threaded through explicitly.
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
  plugins: [
    organization({
      ac,
      roles: {
        admin: adminRole,
        editor: editorRole,
        consumer: consumerRole,
      },
    }),
  ],
});
