import { defineConfig, devices } from "@playwright/test";

// Cross-workspace visibility e2e (ORG-03 UI half): drives the real dashboard
// against a real API + Postgres, so `webServer` boots both apps rather than
// mocking network calls. Chromium is pre-installed in this sandbox at a
// fixed path (not the version this @playwright/test release would normally
// resolve via its own revision-hashed cache); `executablePath` bypasses that
// revision lookup entirely and launches the binary directly, per this
// project's <environment_reality> guidance.
const WEB_PORT = 5173;
const API_PORT = 3000;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @skillshare/api exec nest start",
      cwd: "../..",
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @skillshare/web exec vite --port 5173",
      cwd: "../..",
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
});
