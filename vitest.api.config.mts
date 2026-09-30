import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// API tests: need a running server (API_BASE_URL) and its database (DATABASE_URL). See tests/api/api.test.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
