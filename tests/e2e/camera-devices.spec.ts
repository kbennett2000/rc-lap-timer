// The phone's cameras, in the phone-only app with two of Chromium's synthetic cameras (the "phone-two-cameras" project
// in playwright.config.ts): switching between them while the camera is on, and the frame rate asked for. Run with the phone-only app's tests:
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

test("asks the camera for 60 frames a second, or 30 to save battery, and says what it sends", async ({ page }) => {
  // Every request to the camera, as JSON.
  await page.addInitScript(() => {
    const asked: string[] = [];
    Object.assign(window, { asked });
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      asked.push(JSON.stringify(constraints?.video));
      return getUserMedia(constraints);
    };
    const applyConstraints = MediaStreamTrack.prototype.applyConstraints;
    MediaStreamTrack.prototype.applyConstraints = function (constraints) {
      asked.push(JSON.stringify(constraints));
      return applyConstraints.call(this, constraints);
    };
  });
  const asked = () => page.evaluate(() => (window as unknown as { asked: string[] }).asked);
  await page.goto("./");
  await addFixtures(page, "Speed");
  await page.getByLabel("Time Using Motion Detection").click();
  await expect(page.getByLabel("Camera speed")).toHaveValue("fast");

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  // Chromium's synthetic camera can only do 20.
  await expect(page.getByTestId("camera-rate")).toHaveText("The camera sends 20 frames a second (asked for 60).");
  expect((await asked())[0]).toContain('"frameRate":{"ideal":60}');

  await page.getByLabel("Camera speed").selectOption("saver");
  await expect(page.getByTestId("camera-rate")).toContainText("(asked for 30)");
  expect((await asked()).at(-1)).toContain('"frameRate":{"ideal":30}');
  await page.getByRole("button", { name: "Stop Preview" }).click();

  await page.reload();
  await page.getByLabel("Time Using Motion Detection").click();
  await expect(page.getByLabel("Camera speed"), "remembered on the phone").toHaveValue("saver");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("camera-rate")).toContainText("(asked for 30)");
  expect((await asked())[0]).toContain('"frameRate":{"ideal":30}');
  await page.getByRole("button", { name: "Stop Preview" }).click();
});
