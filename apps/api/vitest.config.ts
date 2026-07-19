import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: ".",
    include: [
      "test/**/*.spec.ts",
      "test/**/*.e2e-spec.ts",
      "src/**/*.spec.ts",
    ],
    setupFiles: ["./test/setup.ts"],
    // e2e specs run against one shared, real Postgres database (no
    // per-test-file isolated schema/testcontainer yet — RESEARCH.md's
    // "Wave 0 Gaps" flagged this as an open item). Multiple *.e2e-spec.ts
    // files truncate overlapping tables (User/Session/Account) in their own
    // afterEach hooks; Vitest's default parallel-file execution let two
    // files race those truncations against each other once a second e2e
    // spec (workspaces.e2e-spec.ts) was added, causing intermittent FK
    // violations / wrong-membership failures. Serializing file execution
    // removes the race; a future phase can revisit per-file DB isolation if
    // e2e suite runtime becomes a problem at a larger scale.
    fileParallelism: false,
  },
});
