import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Cross-workspace visibility e2e (ORG-03 UI half): drives the real dashboard
// against a real API + Postgres, so `webServer` boots both apps rather than
// mocking network calls.
//
// Port derivation: this sandbox runs several worktree-isolated executor
// agents concurrently on the SAME host network — sibling agents' own dev
// servers were observed bound to the conventional 3000/5173 ports while this
// suite was being built. Playwright's `reuseExistingServer` would happily
// treat any listener already on those ports as "already up" and silently
// test against a COMPLETELY DIFFERENT worktree's code (a false-positive/
// false-negative risk, not just a port clash). Deriving a worktree-unique
// port pair from `process.cwd()` (stable across runs within this worktree,
// effectively unique across worktrees) avoids that instead of hardcoding
// 3000/5173; `reuseExistingServer: false` additionally ensures Playwright
// always spawns its own fresh pair rather than adopting a stray listener.
const portOffset =
  createHash("md5").update(process.cwd()).digest().readUInt16BE(0) % 2000;
const API_PORT = 20000 + portOffset;
const WEB_PORT = API_PORT + 1;
// Exported so spec files can hit the API directly (bypassing
// vite.config.ts's dev proxy, which is hardcoded to port 3000 and would
// otherwise proxy Playwright's `request` fixture calls to whichever
// worktree currently owns that port — the same false-positive risk the
// port-derivation comment above describes).
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests",
  // Truncates workspace/user (and everything FK'd to them) against the
  // real, persistent local Postgres before the suite runs — otherwise a
  // second `playwright test` invocation would see a non-empty tenant and
  // the workspace-creation bootstrap rule would reject every fresh admin
  // user's first workspace (see tests/global-setup.ts).
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // `nest start` (and `nest start --watch`) execute the compiled output
      // with plain `node`, which fails to resolve `@skillshare/shared`'s
      // extensionless internal imports (`./dto/auth`) under Node's own ESM
      // resolver — the exact `ERR_MODULE_NOT_FOUND` Plan 04 already hit and
      // fixed by switching apps/api's own `start` script to
      // `tsx dist/main.js` (apps/api/package.json). Build once, then run
      // that same proven `start` script here instead of `nest start`.
      command:
        "pnpm --filter @skillshare/api run build && pnpm --filter @skillshare/api run start",
      cwd: "../..",
      port: API_PORT,
      env: { PORT: String(API_PORT), WEB_ORIGIN },
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      // VITE_API_BASE_URL (already read by apps/web/src/lib/api.ts and
      // lib/auth-client.ts for "a non-proxied deployment where the
      // dashboard is served from a different origin than the API") routes
      // every fetch straight at this worktree's own unique API port,
      // instead of relying on vite.config.ts's dev proxy — which is
      // hardcoded to port 3000 and would otherwise proxy to whichever
      // worktree happens to currently own that port.
      command: `pnpm --filter @skillshare/web exec vite --port ${WEB_PORT} --strictPort`,
      cwd: "../..",
      port: WEB_PORT,
      env: { VITE_API_BASE_URL: API_ORIGIN },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chromium is pre-installed in this sandbox at a fixed path (not
        // necessarily the revision this @playwright/test release would
        // normally resolve via its own revision-hashed cache);
        // `executablePath` bypasses that lookup entirely and launches the
        // binary directly, per this project's <environment_reality>
        // guidance.
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
});
