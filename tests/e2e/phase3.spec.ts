// Browser tests for Phase 3's shared data: every screen reads one cache filled through the DataStore, so changes
// show everywhere at once, and coming back to the app picks up changes made on another phone. Setup is the same
// as phase0.spec.ts.

import { expect, request, test, type Page } from "@playwright/test";

type Fixture = { id: string; name: string };

const stamp = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

async function api(method: "GET" | "POST", path: string, body?: unknown) {
  const context = await request.newContext({ baseURL: test.info().project.use.baseURL });
  const response = method === "GET" ? await context.get(path) : await context.post(path, { data: body });
  const json = await response.json();
  await context.dispose();
  return json;
}

// A driver with one car, a location, and a session saved a minute from now, so it's the newest.
async function setUpSession(label: string) {
  const driver: Fixture = (await api("POST", "/api/data", { type: "driver", name: `${label} ${stamp}` })).driver;
  const car: Fixture = (await api("POST", "/api/data", { type: "car", name: "Car", driverId: driver.id })).car;
  const location: Fixture = (await api("POST", "/api/data", { type: "location", name: `${label} Track ${stamp}` }))
    .location;
  const sessionId = crypto.randomUUID();
  await api("POST", "/api/data", {
    session: {
      id: sessionId,
      date: new Date(Date.now() + 60_000).toISOString(),
      driverId: driver.id,
      carId: car.id,
      locationId: location.id,
      laps: [{ lapNumber: 1, lapTime: 10_000 }],
    },
  });
  return { driver, sessionId };
}

async function savedSession(id: string) {
  return (await api("GET", "/api/data")).sessions.find((s: { id: string }) => s.id === id);
}

async function pickSelect(page: Page, placeholder: string, optionText: string) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

async function addInManager(page: Page, button: string, name: string) {
  await page.getByRole("button", { name: button }).click();
  await page.getByPlaceholder("Enter name").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("Manager: new drivers, cars and locations show at once, and on Practice", async ({ page }) => {
  const driver = `Manager Driver ${stamp}`;
  const location = `Manager Track ${stamp}`;
  await page.goto("/");
  await page.getByRole("tab", { name: "Manager" }).click();
  await expect(page.getByRole("tab", { name: "Data" }), "the phone-only app's Data tab").toHaveCount(0);

  await addInManager(page, "Add New Driver", driver);
  await expect(page.getByRole("combobox").filter({ hasText: driver }), "the new driver is selected").toBeVisible();
  await addInManager(page, "Add New Car", "Manager Car");
  await expect(page.getByRole("combobox").filter({ hasText: "Manager Car" })).toBeVisible();

  await page.getByRole("tab", { name: "Locations" }).click();
  await addInManager(page, "Add New Location", location);
  await expect(page.getByRole("combobox").filter({ hasText: location })).toBeVisible();

  // A name already in use is caught before saving.
  await page.getByRole("button", { name: "Add New Location" }).click();
  await page.getByPlaceholder("Enter name").fill(location.toUpperCase());
  await expect(page.getByText("This name already exists")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("tab", { name: "Practice" }).click();
  await pickSelect(page, "Select Driver", driver);
  await pickSelect(page, "Select Car", "Manager Car");
  await pickSelect(page, "Select Location", location);
  await expect(page.getByText(`Location: ${location}`)).toBeVisible();
});

test("Manager: a renamed motion setting shows its new name", async ({ page }) => {
  const name = `Motion ${stamp}`;
  await api("POST", "/api/motion-settings", { name, sensitivity: 50, threshold: 1, cooldown: 1000, framesToSkip: 10 });

  await page.goto("/");
  await page.getByRole("tab", { name: "Manager" }).click();
  await page.getByRole("tab", { name: /Motion/ }).click();
  await pickSelect(page, "Choose a motion setting", name);
  await page.getByRole("button", { name: "Edit motion setting" }).click();
  await page.getByPlaceholder("Enter name").fill(`${name} renamed`);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("combobox").filter({ hasText: `${name} renamed` })).toBeVisible();
  await page
    .getByRole("combobox")
    .filter({ hasText: `${name} renamed` })
    .click();
  await expect(page.getByRole("option", { name, exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("a session deleted on one phone disappears from another when it comes back to the app", async ({ page }) => {
  const { driver, sessionId } = await setUpSession("Two Phones");
  const other = await page.context().newPage();
  await page.goto("/");
  await other.goto("/");
  const onPage = page.getByText(`Driver: ${driver.name}`);
  const onOther = other.getByText(`Driver: ${driver.name}`);
  await expect(onPage).toBeVisible();
  await expect(onOther).toBeVisible();

  await page.getByRole("button", { name: "Delete session" }).first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(onPage).toHaveCount(0);
  expect(await savedSession(sessionId)).toBeUndefined();

  // Headless pages never become hidden, so send the event a phone sends when the app comes back to the front.
  const reloaded = other.waitForResponse((r) => r.url().endsWith("/api/data") && r.request().method() === "GET");
  await other.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  await reloaded;
  await expect(onOther).toHaveCount(0);
  await other.close();
});

test("saved notes stay after switching tabs", async ({ page }) => {
  const { driver, sessionId } = await setUpSession("Notes");
  await page.goto("/");
  const notesTab = page.getByRole("tab", { name: "Notes" });

  await notesTab.click();
  await page.getByText(driver.name, { exact: true }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByPlaceholder(/Add notes/).fill("Loose rear wheel");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Loose rear wheel")).toBeVisible();

  await page.getByRole("tab", { name: "Current" }).click();
  await notesTab.click();
  await page.getByText(driver.name, { exact: true }).click();
  await expect(page.getByText("Loose rear wheel")).toBeVisible();
  expect((await savedSession(sessionId)).notes).toBe("Loose rear wheel");
});
