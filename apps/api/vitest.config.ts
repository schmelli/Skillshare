import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: ".",
    include: ["test/**/*.spec.ts", "src/**/*.spec.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
