import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: pure code under src/, no database or server.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
