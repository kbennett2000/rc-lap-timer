// Browser tests for the Phase 0 practice-screen fixes, on a phone-sized viewport. They need a running server and
// database, set up as described in tests/api/api.test.ts, then:
//   npx playwright install chromium   (or E2E_CHANNEL=chrome to use an installed Chrome)
//   npm run test:e2e

import { expect, request, test, type Page } from "@playwright/test";
import { expectNoRefusedRequests } from "./pi-helpers";

type Fixture = { id: string; name: string };
type SavedSession = {
  id: string;
  driverId: string;
  date: string;
  createdAt: string;
  notes: string | null;
  laps: unknown[];
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
  return (await api("/api/data")).sessions.filter((s: SavedSession) => s.driverId === driver.id);
}

async function pickSelect(page: Page, placeholder: string, optionText: string) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

// Selections stay set after a session ends, so only pick the ones that are still empty.
async function pickIfEmpty(page: Page, placeholder: string, optionText: string) {
  if ((await page.getByRole("combobox").filter({ hasText: placeholder }).count()) > 0) {
    await pickSelect(page, placeholder, optionText);
  }
}

async function selectDriverCarLocation(page: Page) {
  await pickIfEmpty(page, "Select Driver", driver.name);
  await pickIfEmpty(page, "Select Car", car.name);
  await pickIfEmpty(page, "Select Location", location.name);
}

test.beforeAll(async () => {
  driver = (await api("/api/data", { type: "driver", name: `E2E Driver ${stamp}` })).driver;
  car = (await api("/api/data", { type: "car", name: "E2E Car", driverId: driver.id })).car;
  location = (await api("/api/data", { type: "location", name: `E2E Track ${stamp}` })).location;
});

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("no save loop or polling, and stale cached sessions are not uploaded", async ({ page }) => {
  const ghost = {
    id: `ghost-${stamp}`,
    date: new Date().toISOString(),
    driverId: driver.id,
    carId: car.id,
    locationId: location.id,
    laps: [{ lapNumber: 1, lapTime: 1000 }],
    penalties: [],
    stats: { totalTime: 1000 },
  };
  // Older versions mirrored every session into localStorage and re-uploaded them all every 5 s.
  await page.addInitScript(
    (sessions) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("rc-lap-timer-sessions", sessions);
        localStorage.setItem("rc-lap-timer-drivers", "[]");
      }
    },
    JSON.stringify([ghost]),
  );
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/data")) requests.push(r.method());
  });

  await page.goto("/");
  await page.waitForTimeout(12_000);

  expect(
    requests.filter((m) => m === "POST"),
    "POST /api/data while idle",
  ).toHaveLength(0);
  expect(requests.filter((m) => m === "GET").length, "GETs (initial loads only)").toBeLessThanOrEqual(3);
  const legacyKeys = await page.evaluate(() => [
    localStorage.getItem("rc-lap-timer-sessions"),
    localStorage.getItem("rc-lap-timer-drivers"),
  ]);
  expect(legacyKeys).toEqual([null, null]);
  expect((await sessionsForDriver()).map((s) => s.id)).not.toContain(ghost.id);
});

test("a running session survives a tab switch and a rotation, with setup locked", async ({ page }) => {
  await page.goto("/");
  await selectDriverCarLocation(page);
  const before = (await sessionsForDriver()).length;

  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await expect(page.getByRole("combobox").filter({ hasText: driver.name }).first()).toBeDisabled();
  await expect(page.getByRole("radiogroup").first()).toHaveAttribute("data-disabled", "");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Record Lap" }).click();

  await page.getByRole("tab", { name: "Manager" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(page.getByRole("button", { name: "Record Lap" }), "running after Manager and back").toBeEnabled();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await expect(page.getByRole("button", { name: "Record Lap" }), "running after rotating").toBeEnabled();
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(700);

  const saved = page.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  await saved;

  const after = await sessionsForDriver();
  expect(after).toHaveLength(before + 1);
  const newest = after.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  expect(newest.laps, "2 recorded laps + the final crossing at Stop").toHaveLength(3);
  expect(newest.id).toMatch(/^[0-9a-f-]{36}$/);
  const startedAgo = Date.now() - Date.parse(newest.date);
  expect(startedAgo, "date is the start time, not the save time").toBeGreaterThan(2500);
  expect(startedAgo).toBeLessThan(60_000);
});

test("failed saves are kept, survive a reload, and can be retried", async ({ page }) => {
  const runSession = async () => {
    await selectDriverCarLocation(page);
    await page.getByRole("button", { name: "Start Lap Timer" }).click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "Record Lap" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  };
  const unsavedCount = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("rc-lap-timer-unsaved-sessions") ?? "[]").length);

  await page.goto("/");
  const before = (await sessionsForDriver()).length;
  await page.route("**/api/data", (route) =>
    route.request().method() === "POST" && (route.request().postData() ?? "").includes('"session"')
      ? route.abort()
      : route.continue(),
  );

  await runSession();
  await expect(page.getByText("Session not saved")).toBeVisible();
  expect(await sessionsForDriver()).toHaveLength(before);

  await page.reload();
  await expect(page.getByText("Session not saved"), "banner after a reload").toBeVisible();

  await runSession();
  await expect(page.getByText("2 sessions not saved"), "second failure is added").toBeVisible();

  await page.unrouteAll();
  const savedThird = page.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "POST");
  await runSession();
  await savedThird;
  await page.waitForTimeout(500);
  expect(await unsavedCount(), "a later successful save keeps the earlier unsaved ones").toBe(2);
  await expect(page.getByText("2 sessions not saved")).toBeVisible();

  await page.getByRole("button", { name: "Retry save" }).click();
  // Retry saves them one at a time, and the banner reads "Session not saved" while the last one is sent.
  await expect(page.getByText(/sessions? not saved/i)).toBeHidden();
  expect(await sessionsForDriver(), "all three saved exactly once").toHaveLength(before + 3);
  expect(await unsavedCount()).toBe(0);
});

test("saved notes stay", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Notes" }).click();
  // Within the Notes tab: the Current tab stays on the page (hidden), with the driver's name in it too.
  const notes = page.getByRole("tabpanel", { name: "Notes" });
  await notes.getByText(driver.name).first().click();
  await notes.getByRole("button", { name: "Edit" }).click();
  const text = `Tried softer springs ${stamp}`;
  await notes.getByRole("textbox").fill(text);
  await notes.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1500);
  await expect(notes.getByText(text)).toBeVisible();
  expect(
    (await sessionsForDriver()).some((s) => s.notes === text),
    "note stored on the server",
  ).toBe(true);
});

test("System Settings need the admin PIN and show server errors", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Manager" }).click();
  await page.getByRole("tab", { name: /System/ }).click();
  const save = page.getByRole("button", { name: "Save & Reboot" });
  await expect(save, "disabled until something changes").toBeDisabled();

  await page.getByLabel("Device Name").fill("new-name");
  await save.click();
  await expect(page.getByText("Enter the admin PIN.")).toBeVisible();

  await page.getByLabel("Admin PIN").fill("wrong-pin");
  await save.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Save & Reboot" }).click();
  // The API tests may already have tripped the lockout, so either rejection counts.
  await expect(page.getByText(/Wrong admin PIN|Too many wrong PIN attempts/)).toBeVisible();
});
