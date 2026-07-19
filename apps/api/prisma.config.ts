import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7's config loader evaluates this file (and resolves `env(...)` calls
// inside `defineConfig`) BEFORE it applies its own .env auto-discovery, so
// `DATABASE_URL` is not yet in `process.env` at this point unless we load it
// ourselves first. Node's native `loadEnvFile` (no extra dependency) covers it.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // .env is optional in environments where DATABASE_URL is already exported
  // (e.g. CI, Docker Compose `environment:`); ignore ENOENT here.
}

// Prisma 7: datasource url + migrations config live here, not in schema.prisma
// (RESEARCH.md Pitfall 1).
//
// DEVIATION from RESEARCH.md's Code Examples: the installed `@prisma/config@7.8.0`
// `PrismaConfig` type (re-exported from the `prisma/config` import above) has no
// `adapter` field — only `datasource: { url, shadowDatabaseUrl }` — so `PrismaPg`
// cannot be constructed here. Verified directly against
// node_modules/@prisma/config@7.8.0's dist/index.d.ts and by successfully running
// `prisma migrate dev --name init` against a live Postgres instance using only
// `datasource.url` below. The `PrismaPg` driver-adapter instance (mandatory for
// the query engine at runtime, since Prisma 7 has no Rust engine) is constructed
// in `src/prisma/prisma.service.ts` instead — the CLI (`migrate`/`db push`/
// `studio`) only needs a plain connection string, not the adapter instance.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
