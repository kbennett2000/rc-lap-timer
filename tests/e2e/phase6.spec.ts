// Browser tests for the timer's backups (Manager → Data): the same backup file as the phone app, saved from the timer
// and restored into it. Also, the timer's pages tell it the time. Setup is the same as phase0.spec.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { expect, request, test, type Page } from "@playwright/test";
import { expectNoRefusedRequests } from "./pi-helpers";

const stamp = Date.now().toString(36);

test.describe.configure({ mode: "serial" });
expectNoRefusedRequests();

async function api(method: "GET" | "POST" | "DELETE", path: string, body?: unknown) {
  const context = await request.newContext({ baseURL: test.info().project.use.baseURL });
  const response = await context.fetch(path, { method, data: body });
  const json = await response.json();
  await context.dispose();
  return json;
}

async function openDataTab(page: Page) {
  await page.getByRole("tab", { name: "Manager" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("saves the timer's data as a backup, with what was deleted", async ({ page }, testInfo) => {
  const gone = (await api("POST", "/api/data", { type: "driver", name: `Gone ${stamp}` })).driver;
  await api("DELETE", "/api/manage", { type: "driver", driverId: gone.id });

  await page.goto("/");
  await openDataTab(page);
  await expect(page.getByText("A backup file holds everything on the timer.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save a backup" }).click();
  const file = testInfo.outputPath("timer-backup.json");
  await (await download).saveAs(file);
  await expect(page.getByText("Backup saved to your downloads.")).toBeVisible();
  await expect(page.getByText("Last backup: today.")).toBeVisible();

  const backup = JSON.parse(readFileSync(file, "utf8"));
  expect(backup).toMatchObject({ format: "rc-lap-timer", schemaVersion: 1 });
  expect(backup.tombstones).toContainEqual(expect.objectContaining({ kind: "driver", id: gone.id }));
  expect(backup.data.drivers.map((d: { id: string }) => d.id)).not.toContain(gone.id);
});

test("restores a backup into the timer, after showing what it will do", async ({ page }, testInfo) => {
  const at = new Date().toISOString();
  const stamps = { createdAt: at, updatedAt: at };
  const driver = { id: crypto.randomUUID(), name: `Restored ${stamp}`, ...stamps };
  const file = testInfo.outputPath("phone-backup.json");
  writeFileSync(
    file,
    JSON.stringify({
      format: "rc-lap-timer",
      schemaVersion: 1,
      exportedAt: at,
      deviceId: crypto.randomUUID(),
      data: {
        drivers: [driver],
        cars: [{ id: crypto.randomUUID(), name: "Slash", driverId: driver.id, defaultCarNumber: null, ...stamps }],
        locations: [{ id: crypto.randomUUID(), name: `Restored Track ${stamp}`, ...stamps }],
        sessions: [],
        motionSettings: [],
      },
      tombstones: [],
      aliases: [],
    }),
  );

  await page.goto("/");
  await openDataTab(page);
  await page.getByLabel("Backup file").setInputFiles(file);
  await expect(page.getByText("This backup holds 1 driver, 1 car and 1 location.")).toBeVisible();
  await expect(page.getByText("Restoring it merges it into the timer:")).toBeVisible();
  await expect(page.getByText("Adds 1 driver, 1 car and 1 location.")).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Backup restored.")).toBeVisible();

  await page.getByLabel("Backup file").setInputFiles(file);
  await expect(page.getByText("Nothing new: the timer already has everything in the backup.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("combobox").filter({ hasText: "Select Driver" }).first().click();
  await expect(page.getByRole("option", { name: driver.name, exact: true })).toBeVisible();
});

test("tells the timer the time as the page opens", async ({ page }) => {
  const told = page.waitForRequest((r) => r.url().endsWith("/api/sync/clock") && r.method() === "POST");
  await page.goto("/");
  const request = await told;
  expect(Math.abs(request.postDataJSON().now - Date.now())).toBeLessThan(60_000);
  // The test server has no helper to set the clock, and its clock is right anyway.
  expect(await (await request.response())?.json()).toEqual({ changed: false, reason: "close" });
});
