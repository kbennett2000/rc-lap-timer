import { defineConfig, devices } from "@playwright/test";

// Which build the server is running: "pi" (the default) or "standalone", the phone-only build. Each has its own tests.
const standalone = process.env.E2E_TARGET === "standalone";

// Browser tests against a running server (E2E_BASE_URL) and its database. See tests/e2e/phase0.spec.ts.
export default defineConfig({
  testDir: "tests/e2e",
  ...(standalone ? { testMatch: "standalone.spec.ts" } : { testIgnore: "standalone.spec.ts" }),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    // Bundled Chromium by default (npx playwright install chromium); E2E_CHANNEL=chrome uses an installed Chrome.
    channel: process.env.E2E_CHANNEL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        // A synthetic camera (a moving test pattern) with the permission prompt auto-accepted, for motion timing.
        launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
      },
    },
  ],
});
