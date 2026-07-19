import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Loaded both when run directly (`tsx prisma/seed.ts`) and via `prisma db seed`
// (which sets DATABASE_URL itself from prisma.config.ts already, but loading
// here too is a harmless no-op in that case).
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // .env is optional if DATABASE_URL is already exported by the environment.
}

// Bootstrap seed: v1 self-hosted Skillshare runs as a single Tenant. Uses a
// fixed id + `upsert` (not `create`) so re-running the seed never creates a
// second Tenant row (idempotency requirement in 01-02-PLAN.md must_haves).
const BOOTSTRAP_TENANT_ID = "tenant_bootstrap";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const tenant = await prisma.tenant.upsert({
      where: { id: BOOTSTRAP_TENANT_ID },
      update: {},
      create: {
        id: BOOTSTRAP_TENANT_ID,
        name: "Default Tenant",
      },
    });
    console.log(`Seeded Tenant: ${tenant.id} (${tenant.name})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
