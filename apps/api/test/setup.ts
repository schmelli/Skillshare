import path from "node:path";
import "reflect-metadata";

// Wave 0 test harness setup. Real e2e bootstrap (Nest TestingModule + an
// ephemeral/test Postgres database) is added alongside auth.e2e-spec.ts,
// workspaces.e2e-spec.ts, membership.e2e-spec.ts, and
// schema-tenant-scoping.spec.ts in later plans per RESEARCH.md's
// "Wave 0 Gaps" section.

// Plan 02: health.e2e-spec.ts boots the real AppModule (PrismaService ->
// Postgres), so DATABASE_URL must be present before the Nest TestingModule
// compiles. Vitest does not auto-load .env like the Prisma CLI does.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // .env is optional if DATABASE_URL is already exported by the environment
  // (e.g. CI sets it directly).
}
