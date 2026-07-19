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
// (RESEARCH.md Pitfall 1). The actual `@prisma/adapter-pg` driver-adapter
// instance used by the generated PrismaClient at runtime is constructed in
// `src/prisma/prisma.service.ts` — the CLI (`migrate`/`db push`/`studio`)
// only needs a connection string, not the adapter instance itself.
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
