import { defineConfig, devices } from "@playwright/test";

// What the tests run against: "pi" (the default), "standalone" (the phone-only build), or "sync" (the phone-only build
// syncing with a Pi build next to it). Each has its own tests.
const target = process.env.E2E_TARGET ?? "pi";
const ONLY = { standalone: "standalone.spec.ts", sync: "sync.spec.ts" };
const baseURLs: Record<string, string> = {
  pi: "http://127.0.0.1:3100",
  standalone: "http://127.0.0.1:3100/rc-lap-timer/",
  sync: "http://127.0.0.1:3200/rc-lap-timer/",
};

// Browser tests against a running server (E2E_BASE_URL) and its database. See tests/e2e/phase0.spec.ts.
export default defineConfig({
  testDir: "tests/e2e",
  ...(target in ONLY ? { testMatch: ONLY[target as keyof typeof ONLY] } : { testIgnore: Object.values(ONLY) }),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    // The phone-only app is served under its GitHub Pages path (npm run serve:pages); its tests open "./".
    baseURL: process.env.E2E_BASE_URL ?? baseURLs[target],
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
