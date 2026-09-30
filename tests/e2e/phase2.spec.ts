// Browser tests for the Phase 2 timing engine: resuming after a reload, lap accuracy, motion timing with a fake
// camera, and the live view on the Pi. Setup is the same as phase0.spec.ts.

import { expect, request, test, type Page } from "@playwright/test";
import { expectNoRefusedRequests } from "./pi-helpers";

type Fixture = { id: string; name: string };
type SavedSession = {
  id: string;
  driverId: string;
  date: string;
  createdAt: string;
  laps: { lapTime: number; lapNumber: number }[];
};

const stamp = Date.now().toString(36);
let driver: Fixture;
let car: Fixture;
let location: Fixture;

test.describe.configure({ mode: "serial" });
expectNoRefusedRequests();

async function api(path: string, body?: unknown) {
  const context = await request.newContext({ baseURL: test.info().project.use.baseURL });
  const response = body === undefined ? await context.get(path) : await context.post(path, { data: body });
  const json = await response.json();
  await context.dispose();
  return json;
}

async function sessionsForDriver(): Promise<SavedSession[]> {
  const sessions: SavedSession[] = (await api("/api/data")).sessions.filter(
    (s: SavedSession) => s.driverId === driver.id,
  );
  return sessions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function setUp(page: Page) {
  await page.goto("/");
  for (const [placeholder, name] of [
    ["Select Driver", driver.name],
    ["Select Car", car.name],
    ["Select Location", location.name],
  ]) {
    await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
    await page.getByRole("option", { name, exact: true }).click();
  }
}

const savedAfter = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "POST");

test.beforeAll(async () => {
  driver = (await api("/api/data", { type: "driver", name: `Engine Driver ${stamp}` })).driver;
  car = (await api("/api/data", { type: "car", name: "Engine Car", driverId: driver.id })).car;
  location = (await api("/api/data", { type: "location", name: `Engine Track ${stamp}` })).location;
});

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("a run survives a reload and can be resumed", async ({ page }) => {
  await setUp(page);
  const before = (await sessionsForDriver()).length;
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Record Lap" }).click();
  const startedAt = await page.evaluate(
    () => JSON.parse(localStorage.getItem("rc-lap-timer-active-run:v1") ?? "{}").startedAt as number,
  );

  await page.reload();
  await expect(page.getByText("A session was running")).toBeVisible();
  await expect(page.getByText(`${driver.name} / ${car.name}, 1 lap`)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Record Lap" })).toBeEnabled();

  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(400);
  const saved = savedAfter(page);
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  await saved;

  const sessions = await sessionsForDriver();
  expect(sessions).toHaveLength(before + 1);
  expect(sessions[0].laps, "the lap before the reload, one after, and the final crossing").toHaveLength(3);
  expect(Math.abs(Date.parse(sessions[0].date) - startedAt), "dated at the original start").toBeLessThan(2);
  expect(await page.evaluate(() => localStorage.getItem("rc-lap-timer-active-run:v1"))).toBeNull();
});

test("lap times match the taps", async ({ page }) => {
  await setUp(page);
  // When each tap reached the page. Playwright's own waits stretch on a busy machine, so they can't be the reference.
  await page.evaluate(() => {
    const taps: number[] = [];
    Object.assign(window, { taps });
    document.addEventListener("click", () => taps.push(performance.timeOrigin + performance.now()), true);
  });
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(1500);
  const saved = savedAfter(page);
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  await saved;

  const taps: number[] = await page.evaluate(() => (window as unknown as { taps: number[] }).taps);
  expect(taps).toHaveLength(4);
  const laps = [...(await sessionsForDriver())[0].laps].sort((a, b) => a.lapNumber - b.lapNumber);
  expect(laps).toHaveLength(3);
  laps.forEach((lap, i) => {
    const between = taps[i + 1] - taps[i];
    expect(Math.abs(lap.lapTime - between), `lap ${i + 1}: ${lap.lapTime} ms, taps ${between} ms`).toBeLessThan(20);
  });
});

test("the live view gets each lap with its own penalties, and is cleared at the end", async ({ page }) => {
  await setUp(page);
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.getByRole("button", { name: "Add Penalty" }).click();
  await page.getByRole("button", { name: "Add Penalty" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Record Lap" }).click();

  const livePenalties = async () =>
    ((await api("/api/current-session/summary")).sessions[0]?.laps ?? []).map(
      (lap: { penaltyCount: number }) => lap.penaltyCount,
    );
  await expect.poll(livePenalties).toEqual([2, 0]);

  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  await expect.poll(async () => (await api("/api/current-session/summary")).sessions).toEqual([]);
});

test("motion timing with a camera records laps and turns the camera off", async ({ page }) => {
  // Keep every camera stream so the test can check they were stopped.
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      w.__streams.push(stream);
      return stream;
    };
  });
  const allCamerasOff = () =>
    page.evaluate(() =>
      (window as unknown as { __streams: MediaStream[] }).__streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    );

  await setUp(page);
  await page.getByLabel("Time Using Motion Detection").click();
  // Most sensitive, shortest cooldown: the fake camera's moving pattern then counts as a crossing every 300 ms.
  const sliders = page.locator('input[type="range"]');
  await sliders.nth(0).fill("200"); // sensitivity
  await sliders.nth(1).fill("0.1"); // threshold %
  await sliders.nth(2).fill("300"); // cooldown ms
  await sliders.nth(3).fill("1"); // frames to skip

  const before = (await sessionsForDriver()).length;
  await page.getByRole("button", { name: "Cam On" }).click();
  await expect(page.getByRole("button", { name: "Stop Timer" }), "the first detection starts the run").toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(2500);
  const saved = savedAfter(page);
  await page.getByRole("button", { name: "Stop Timer" }).click();
  await saved;

  const sessions = await sessionsForDriver();
  expect(sessions).toHaveLength(before + 1);
  expect(sessions[0].laps.length).toBeGreaterThanOrEqual(2);
  for (const lap of sessions[0].laps) expect(lap.lapTime, "no lap shorter than the cooldown").toBeGreaterThan(290);
  await expect.poll(allCamerasOff, { message: "camera off after the run" }).toBe(true);

  // Preview uses the camera without starting a run; leaving motion mode must turn it off.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(allCamerasOff).toBe(false);
  await page.getByLabel("Time Using UI").click();
  await expect.poll(allCamerasOff, { message: "camera off after leaving motion mode" }).toBe(true);
});
