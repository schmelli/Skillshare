import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

// apps/web is "type": "module" (no CJS __dirname global) — derive the same
// thing from import.meta.url, matching vite.config.ts's own convention.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Unlike apps/api's Vitest e2e specs (which truncate between every single
// test via their own `afterEach`), this Playwright suite runs against a
// real, persistent local Postgres instance across repeated `playwright
// test` invocations during development — without this, workspace/user rows
// from a PRIOR run accumulate, and the workspace-creation bootstrap rule
// (`WorkspacesService.canCreateWorkspace`: only the very FIRST workspace in
// an empty tenant is self-service) makes every subsequent run's fresh admin
// user unable to create a workspace at all. Truncating once before the
// whole suite runs (never inside a single test) gives each `playwright
// test` invocation the same clean-tenant starting state the API's own e2e
// suite already assumes. The seeded Tenant row itself is never touched,
// matching every apps/api e2e spec's own convention.
export default async function globalSetup() {
  try {
    process.loadEnvFile(
      path.join(__dirname, "..", "..", "api", ".env"),
    );
  } catch {
    // .env is optional if DATABASE_URL is already exported by the
    // environment (e.g. CI).
  }

  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/skillshare",
  });
  await client.connect();
  // CASCADE also clears everything with a FK back to these two tables
  // (membership, session, account, and better-auth's own member/invitation
  // tables) regardless of their own ON DELETE clause — TRUNCATE's CASCADE
  // is independent of any DELETE-time cascade rule.
  await client.query(
    'TRUNCATE TABLE "workspace", "user" RESTART IDENTITY CASCADE;',
  );
  await client.end();
}
