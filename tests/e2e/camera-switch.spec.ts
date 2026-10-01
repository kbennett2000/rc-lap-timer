// Switching cameras while the camera is on, in the phone-only app with two of Chromium's synthetic cameras (the
// "phone-two-cameras" project in playwright.config.ts). Run with the phone-only app's tests:
// E2E_TARGET=standalone npm run test:e2e (see standalone.spec.ts).

import { expect, test } from "@playwright/test";
import { addFixtures } from "./phone-helpers";

test("follows the camera chosen while the camera is on", async ({ page }) => {
  await page.goto("./");
  await addFixtures(page, "Switch");
  await page.getByLabel("Time Using Motion Detection").click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("frame-stats")).toBeVisible();

  // The preview's camera: which one, and whether its stream is still running.
  const showing = () =>
    page.evaluate(() => {
      const track = (document.querySelector("video")?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      return track ? `${track.label} ${track.readyState}` : "nothing";
    });
  await expect.poll(showing).toBe("fake_device_0 live");

  await page.locator("#cameraSelect").selectOption({ label: "fake_device_1" });
  await expect.poll(showing, "the preview shows the new camera").toBe("fake_device_1 live");
  // Still checking frames from it.
  await expect(page.getByTestId("frame-stats")).toContainText("timed by the camera");
  await page.getByRole("button", { name: "Stop Preview" }).click();
});

test("uses the default camera when the one chosen before has gone", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rc-lap-timer-camera-id", "a-camera-that-has-gone"));
  await page.goto("./");
  await addFixtures(page, "Gone");
  await page.getByLabel("Time Using Motion Detection").click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("frame-stats")).toContainText("timed by the camera");
  await expect(page.locator("#cameraSelect")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("rc-lap-timer-camera-id"))).toBeNull();
  await page.getByRole("button", { name: "Stop Preview" }).click();
});
