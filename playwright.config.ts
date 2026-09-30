import { defineConfig, devices, type Project } from "@playwright/test";
import { crossingVideo } from "./tests/e2e/crossing-video";

// What the tests run against: "pi" (the default), "standalone" (the phone-only build), or "sync" (the phone-only build
// syncing with a Pi build next to it). Each has its own tests.
const target = process.env.E2E_TARGET ?? "pi";
const CAMERA = "camera.spec.ts";
const ONLY: Record<string, string[]> = { standalone: ["standalone.spec.ts", CAMERA], sync: ["sync.spec.ts"] };
const baseURLs: Record<string, string> = {
  pi: "http://127.0.0.1:3100",
  standalone: "http://127.0.0.1:3100/rc-lap-timer/",
  sync: "http://127.0.0.1:3200/rc-lap-timer/",
};

const phone = {
  ...devices["Desktop Chrome"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
};
// A camera with its permission prompt accepted: by default Chromium's synthetic one (a moving test pattern).
const FAKE_CAMERA = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];

const projects: Project[] = [
  {
    name: "phone",
    ...(target in ONLY
      ? { testMatch: ONLY[target].filter((spec) => spec !== CAMERA) }
      : { testIgnore: Object.values(ONLY).flat() }),
    use: { ...phone, launchOptions: { args: FAKE_CAMERA } },
  },
];
// Camera timing in the phone-only app, with a video of a car crossing as the camera (tests/e2e/crossing-video.ts).
if (target === "standalone") {
  projects.push({
    name: "phone-video",
    testMatch: CAMERA,
    use: {
      ...phone,
      launchOptions: { args: [...FAKE_CAMERA, `--use-file-for-fake-video-capture=${crossingVideo()}`] },
    },
  });
}

// Browser tests against a running server (E2E_BASE_URL) and its database. See tests/e2e/phase0.spec.ts.
export default defineConfig({
  testDir: "tests/e2e",
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
  projects,
});
