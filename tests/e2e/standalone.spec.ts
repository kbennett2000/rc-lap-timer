// Browser tests for the phone-only build. Run them against a server built with NEXT_PUBLIC_TARGET=standalone:
//   NEXT_PUBLIC_TARGET=standalone npm run build && npx next start -p 3100 &
//   E2E_TARGET=standalone npm run test:e2e
// Until that build gets its on-device store, it still saves to the Pi's API, so the setup is otherwise the same as
// phase0.spec.ts.

import { expect, request, test, type Page } from "@playwright/test";

type Fixture = { id: string; name: string };

const stamp = Date.now().toString(36);
// Endpoints for Pi hardware and Pi-only features: the phone-only build must never call them.
const PI_ONLY = /^\/api\/(ir|led|current-session|session-requests|system|races)(\/|$)/;

let driver: Fixture;
let car: Fixture;
let location: Fixture;

test.describe.configure({ mode: "serial" });

async function api(path: string, body?: unknown) {
  const context = await request.newContext({ baseURL: test.info().project.use.baseURL });
  const response = body === undefined ? await context.get(path) : await context.post(path, { data: body });
  const json = await response.json();
  await context.dispose();
  return json;
}

async function pickSelect(page: Page, placeholder: string, optionText: string) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

// Records every request to a Pi-only endpoint.
function watchPiCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (PI_ONLY.test(path)) calls.push(`${r.method()} ${path}`);
  });
  return calls;
}

test.beforeAll(async () => {
  driver = (await api("/api/data", { type: "driver", name: `Phone Driver ${stamp}` })).driver;
  car = (await api("/api/data", { type: "car", name: "Phone Car", driverId: driver.id, defaultCarNumber: 3 })).car;
  location = (await api("/api/data", { type: "location", name: `Phone Track ${stamp}` })).location;
});

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("hides the Pi's features, times a run, and never calls the Pi's hardware", async ({ page }) => {
  const piCalls = watchPiCalls(page);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Race" })).toHaveCount(0);
  await expect(page.getByText("Time Using UI")).toBeVisible();
  await expect(page.getByText("Time Using Motion Detection")).toBeVisible();
  await expect(page.getByText("Time Using IR")).toHaveCount(0);
  await expect(page.getByText("Enable Remote Control Mode")).toHaveCount(0);

  await pickSelect(page, "Select Driver", driver.name);
  await page.getByRole("button", { name: "New Car" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("Default IR Car Number")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();

  await pickSelect(page, "Select Car", car.name);
  await pickSelect(page, "Select Location", location.name);
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(400);
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  expect((await saved).ok()).toBe(true);
  const sessions = (await api("/api/data")).sessions.filter((s: { driverId: string }) => s.driverId === driver.id);
  expect(sessions).toHaveLength(1);
  expect(sessions[0].laps).toHaveLength(2);

  await page.getByRole("tab", { name: /Session/ }).click();
  await expect(page.getByText("Request a Session")).toHaveCount(0);
  await expect(page.getByText("Current Session", { exact: true })).toHaveCount(0);
  await expect(page.getByText(`Driver: ${driver.name}`)).toBeVisible();
  for (const tab of ["Best", "Compare", "Notes"]) await page.getByRole("tab", { name: tab }).click();

  await page.getByRole("tab", { name: "Manager" }).click();
  await expect(page.getByRole("tab", { name: /System/ })).toHaveCount(0);
  await pickSelect(page, "Choose a driver", driver.name);
  await pickSelect(page, "Choose a car", car.name);
  await page.getByRole("button", { name: "Edit car" }).click();
  await expect(page.getByText("Default IR Car Number")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  for (const tab of [/Locations/, /Motion/, /Utilities/]) await page.getByRole("tab", { name: tab }).click();

  expect(piCalls, "requests to Pi-only endpoints").toEqual([]);
});

test("an interrupted IR run resumes with tap timing, so it can be stopped", async ({ page }) => {
  const piCalls = watchPiCalls(page);
  const startedAt = Date.now() - 5_000;
  await page.addInitScript(
    ([run]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("rc-lap-timer-active-run:v1", run);
    },
    [
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
    ],
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Record Lap" })).toBeEnabled();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
  expect((await saved).ok()).toBe(true);
  expect(piCalls, "requests to Pi-only endpoints").toEqual([]);
});
