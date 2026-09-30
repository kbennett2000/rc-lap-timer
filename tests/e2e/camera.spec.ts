// Camera timing in the phone-only app, with a video as the camera: a car crossing the picture once per loop
// (crossing-video.ts; the "phone-video" project in playwright.config.ts plays it). So every lap should be one loop long.
// Run with the phone-only app's tests: E2E_TARGET=standalone npm run test:e2e (see standalone.spec.ts).

import { expect, test, type Page } from "@playwright/test";
import { CROSSING_VIDEO, LOOP_MS } from "./crossing-video";
import { addFixtures } from "./phone-helpers";

const FRAME_MS = 1000 / CROSSING_VIDEO.fps;

// Checks the laps are one loop each, and how steady they are. The camera can come on while the car is mid-crossing,
// which starts the run late in that crossing, so only the laps after the first are whole loops.
function expectLoopLaps(laps: number[], toleranceMs: number) {
  const whole = laps.slice(1);
  expect(whole.length, "whole laps").toBeGreaterThanOrEqual(2);
  const typical = [...whole].sort((a, b) => a - b)[Math.floor(whole.length / 2)];
  // One crossing per loop. (Chromium's file camera can add a frame as it goes back to the start.)
  expect(typical, "a typical lap").toBeGreaterThanOrEqual(LOOP_MS - FRAME_MS);
  expect(typical, "a typical lap").toBeLessThanOrEqual(LOOP_MS + 2 * FRAME_MS);
  for (const lap of whole) {
    expect(Math.abs(lap - typical), `a lap of ${lap} ms, against ${typical} ms`).toBeLessThanOrEqual(toleranceMs);
  }
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

async function setUp(page: Page, label: string) {
  await page.goto("./");
  await addFixtures(page, label);
  await page.getByLabel("Time Using Motion Detection").click();
  const sliders = page.locator('input[type="range"]');
  await sliders.nth(2).fill("1000"); // cooldown ms: longer than a crossing, shorter than a loop
  await sliders.nth(3).fill("1"); // frames to skip
}

// The preview's frame stats: how many frames a second it checks, and what times them.
async function frameStats(page: Page) {
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const stats = page.getByTestId("frame-stats");
  await expect(stats).toBeVisible();
  await page.waitForTimeout(1500);
  const text = (await stats.textContent()) ?? "";
  await page.getByRole("button", { name: "Stop Preview" }).click();
  return { text, framesPerSecond: Number(/Checking (\d+) frames a second/.exec(text)?.[1]) };
}

// Times a run of about four loops, and returns its laps. `meanwhile` runs once the run has started.
async function timeRun(page: Page, meanwhile?: () => Promise<void>): Promise<number[]> {
  await page.getByRole("button", { name: "Cam On" }).click();
  await expect(page.getByRole("button", { name: "Stop Timer" }), "the first crossing starts the run").toBeVisible({
    timeout: 15_000,
  });
  const started = Date.now();
  await meanwhile?.();
  await page.waitForTimeout(Math.max(0, 4 * LOOP_MS + LOOP_MS / 2 - (Date.now() - started)));
  await page.getByRole("button", { name: "Stop Timer" }).click();

  let laps: number[] = [];
  await expect
    .poll(async () => {
      laps = await page.evaluate(
        () =>
          new Promise<number[]>((resolve, reject) => {
            const open = indexedDB.open("rc-lap-timer");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const request = open.result.transaction("sessions").objectStore("sessions").getAll();
              request.onsuccess = () => {
                const sessions = request.result as { laps: { lapTime: number }[] }[];
                resolve(sessions.flatMap((session) => session.laps.map((lap) => lap.lapTime)));
                open.result.close();
              };
              request.onerror = () => reject(request.error);
            };
          }),
      );
      return laps.length;
    }, "the run is saved")
    .toBeGreaterThanOrEqual(3);
  return laps;
}

test("times each crossing by the camera's frames, so every lap is one loop", async ({ page }) => {
  await setUp(page, "Camera");
  const stats = await frameStats(page);
  expect(stats.text).toContain("timed by the camera");
  // Each of the camera's 30 frames a second is checked once, not on every refresh of a 60 Hz screen.
  expect(stats.framesPerSecond).toBeGreaterThanOrEqual(25);
  expect(stats.framesPerSecond).toBeLessThanOrEqual(35);

  // Each crossing is timed by the frame the car appears in, so the laps agree to within a few milliseconds.
  expectLoopLaps(await timeRun(page), 10);
});

test("keeps timing on screen refreshes when the browser stops handing over frames", async ({ page }) => {
  // A browser that has requestVideoFrameCallback but never calls back.
  await page.addInitScript(() => {
    HTMLVideoElement.prototype.requestVideoFrameCallback = () => 1;
    HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
  });
  await setUp(page, "Stalled");
  expect((await frameStats(page)).text).toContain("timed when checked");

  // Timed when checked, on the screen's refreshes: less steady, but still one crossing per loop.
  expectLoopLaps(await timeRun(page), 100);
});

test("keeps timing while another tab is open", async ({ page }) => {
  await setUp(page, "Tabs");
  const laps = await timeRun(page, async () => {
    // Look at the best laps for over a lap, then the Manager, then come back.
    await page.getByRole("tab", { name: "Best" }).click();
    await page.waitForTimeout(LOOP_MS * 1.2);
    await page.getByRole("tab", { name: "Current", exact: true }).click();
    await page.getByRole("tab", { name: "Manager" }).click();
    await page.waitForTimeout(LOOP_MS * 1.2);
    await page.getByRole("tab", { name: "Practice" }).click();
  });
  // A crossing missed while the other tab was open would show as a lap two loops long.
  expectLoopLaps(laps, 10);
});
