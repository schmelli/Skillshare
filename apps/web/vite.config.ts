import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Matches components.json's aliases so shadcn/ui component adds resolve correctly.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev-only proxy so the SPA can call the API without CORS during local dev.
      // In prod the built SPA is served same-origin by the Fastify API (Plan 05+).
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
