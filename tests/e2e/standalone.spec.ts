// Browser tests for the phone-only app, a static site that keeps its data on the phone. Build and serve it first:
//   npm run build:pages && npm run serve:pages &
//   E2E_TARGET=standalone npm run test:e2e
// Every test starts with an empty browser, so each one adds its own driver, car and location through the app.

import { spawn } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

type Fixture = { driver: string; car: string; location: string };

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

// Every request to the Pi's API (the phone-only app has no server).
function watchApiCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.includes("/api/")) calls.push(`${r.method()} ${path}`);
  });
  return calls;
}

async function pickSelect(page: Page, placeholder: string, optionText: string) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

// Adds a driver, a car and a location from Practice's setup, which selects each one as it's made.
async function addFixtures(page: Page, label: string): Promise<Fixture> {
  const fixture = { driver: `${label} Driver`, car: `${label} Car`, location: `${label} Track` };
  for (const [button, type, name] of [
    ["New Driver", "driver", fixture.driver],
    ["New Car", "car", fixture.car],
    ["New Location", "location", fixture.location],
  ]) {
    await page.getByRole("button", { name: button }).click();
    await page.getByPlaceholder(`Enter ${type} name`).fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("combobox").filter({ hasText: name })).toBeVisible();
  }
  return fixture;
}

// A saved session's card (Recent Sessions and Session Mgmt), as opposed to the setup summary's "Driver: …".
const sessionCard = (page: Page, fixture: Fixture) => page.getByText(`Driver: ${fixture.driver} - Car: ${fixture.car}`);

async function runSession(page: Page) {
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
}

test("keeps its data on the phone, hides the Pi's features, and never calls an API", async ({ page }) => {
  const apiCalls = watchApiCalls(page);
  await page.goto("./");

  await expect(page.getByRole("tab", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Race" })).toHaveCount(0);
  await expect(page.getByText("Time Using UI")).toBeVisible();
  await expect(page.getByText("Time Using IR")).toHaveCount(0);
  await expect(page.getByText("Enable Remote Control Mode")).toHaveCount(0);

  const fixture = await addFixtures(page, "Phone");
  await page.getByRole("button", { name: "New Car" }).click();
  await expect(page.getByText("Default IR Car Number")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();

  await runSession(page);
  await expect(sessionCard(page, fixture)).toBeVisible();
  await expect(page.getByText("Session not saved")).toHaveCount(0);

  await page.reload();
  await expect(sessionCard(page, fixture), "the session is still there after a reload").toBeVisible();

  await page.getByRole("tab", { name: /Session/ }).click();
  await expect(page.getByText("Request a Session")).toHaveCount(0);
  await expect(page.getByText("Current Session", { exact: true })).toHaveCount(0);
  for (const tab of ["Best", "Compare", "Notes"]) await page.getByRole("tab", { name: tab }).click();

  await page.getByRole("tab", { name: "Manager" }).click();
  await expect(page.getByRole("tab", { name: /System/ })).toHaveCount(0);
  await pickSelect(page, "Choose a driver", fixture.driver);
  await pickSelect(page, "Choose a car", fixture.car);
  await page.getByRole("button", { name: "Edit car" }).click();
  await expect(page.getByText("Default IR Car Number")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  for (const tab of [/Locations/, /Motion/, /Utilities/]) await page.getByRole("tab", { name: tab }).click();

  expect(apiCalls, "requests to an API").toEqual([]);
});

test("an interrupted IR run resumes with tap timing, so it can be stopped", async ({ page }) => {
  const apiCalls = watchApiCalls(page);
  await page.goto("./");
  const fixture = await addFixtures(page, "Resume");

  // An IR run left behind by a crash, for the driver, car and location just made (the phone-only app can't start one).
  await page.evaluate(async (names) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("rc-lap-timer");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const all = (table: string) =>
      new Promise<{ id: string; name: string }[]>((resolve) => {
        const request = database.transaction(table).objectStore(table).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    const find = async (table: string, name: string) => (await all(table)).find((row) => row.name === name)!;
    const [driver, car, location] = [
      await find("drivers", names.driver),
      await find("cars", names.car),
      await find("locations", names.location),
    ];
    database.close();
    const startedAt = Date.now() - 5_000;
    localStorage.setItem(
      "rc-lap-timer-active-run:v1",
      JSON.stringify({
        status: "running",
        id: crypto.randomUUID(),
        config: {
          driverId: driver.id,
          driverName: driver.name,
          carId: car.id,
          carName: car.name,
          locationId: location.id,
          locationName: location.name,
          lapTarget: "unlimited",
          timingMode: "ir",
        },
        startedAt,
        lastEventAt: startedAt + 2_000,
        crossings: [startedAt + 2_000],
        penalties: [],
        gaps: [],
      }),
    );
  }, fixture);

  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Record Lap" })).toBeEnabled();
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  await expect(sessionCard(page, fixture)).toBeVisible();
  await expect(page.getByText("Session not saved")).toHaveCount(0);
  expect(apiCalls, "requests to an API").toEqual([]);
});

test("can be installed: manifest and icons", async ({ page, request }) => {
  await page.goto("./");
  const manifestUrl = new URL((await page.locator('link[rel="manifest"]').getAttribute("href"))!, page.url());
  const manifest = await (await request.get(manifestUrl.href)).json();
  expect(manifest).toMatchObject({
    id: "/rc-lap-timer/",
    name: "RC Lap Timer",
    start_url: "./",
    scope: "./",
    display: "standalone",
  });
  expect(manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, manifestUrl).href)).ok(), icon.src).toBe(true);
  }
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIcon).toMatch(/^\/rc-lap-timer\/apple-icon\.png/);
});

test("opens with its data when the site can't be reached", async ({ page }) => {
  // A server of its own, so this test can stop it.
  const url = "http://127.0.0.1:3101/rc-lap-timer/";
  const server = spawn(process.execPath, ["scripts/serve-static.mjs", "--port", "3101"], { stdio: "ignore" });
  try {
    await expect
      .poll(() =>
        fetch(url).then(
          (r) => r.status,
          () => 0,
        ),
      )
      .toBe(200);
    await page.goto(url);
    const fixture = await addFixtures(page, "Offline");

    // The service worker takes over pages opened after it's installed.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    server.kill();
    await expect
      .poll(() =>
        fetch(url).then(
          (r) => r.status,
          () => 0,
        ),
      )
      .toBe(0);
    const response = await page.reload();
    expect(response?.fromServiceWorker(), "served by the service worker").toBe(true);
    // The records made before the server went away are all there.
    await pickSelect(page, "Select Driver", fixture.driver);
    await pickSelect(page, "Select Car", fixture.car);
    await pickSelect(page, "Select Location", fixture.location);
    await expect(page.getByText(`Location: ${fixture.location}`)).toBeVisible();
  } finally {
    server.kill();
  }
});
