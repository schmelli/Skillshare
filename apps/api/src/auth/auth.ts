import path from "node:path";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  // BETTER_AUTH_SECRET / BETTER_AUTH_URL are read automatically from
  // process.env by better-auth's own config resolution; only the
  // dev-vs-prod-variable WEB_ORIGIN needs to be threaded through explicitly.
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:5173"],
});
