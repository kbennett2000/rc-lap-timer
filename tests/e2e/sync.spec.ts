// Browser tests for syncing the phone-only app with a timer: the phone app (static, as GitHub Pages serves it) and the
// Pi build side by side, as in CI's integration job. Build the phone app first (both builds use .next):
//   npm run build:pages && npm run build
//   SYNC_ALLOWED_ORIGINS=http://127.0.0.1:3200 npx next start -p 3100 -H 127.0.0.1 &
//   node scripts/serve-static.mjs --port 3200 &
//   E2E_TARGET=sync npm run test:e2e

import { expect, request, test, type Page } from "@playwright/test";
import { addFixtures, openDataTab, pickSelect, runSession, sessionCard } from "./phone-helpers";

const TIMER = process.env.E2E_TIMER_URL ?? "http://127.0.0.1:3100";
const stamp = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

async function timerApi(method: "GET" | "POST", path: string, body?: unknown) {
  const context = await request.newContext({ baseURL: TIMER });
  const response = await context.fetch(path, { method, data: body });
  const json = await response.json();
  await context.dispose();
  return json;
}

async function syncWith(page: Page, address = TIMER) {
  await openDataTab(page);
  await page.getByText("Timer address").first().click();
  await page.getByLabel("Timer address").fill(address);
  await page.getByRole("button", { name: "Sync with the timer" }).click();
}

// The phone's drivers, straight from its database.
function phoneDriverIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("rc-lap-timer");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("drivers").objectStore("drivers").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve(all.result.map((driver: { id: string }) => driver.id));
          };
        };
      }),
  );
}

test("syncs both ways with the timer, and a second sync changes nothing", async ({ page }) => {
  // On the timer: a driver the phone doesn't have, and one the phone has under the same name.
  const timerOnly = (await timerApi("POST", "/api/data", { type: "driver", name: `Timer Only ${stamp}` })).driver;
  const shared = (await timerApi("POST", "/api/data", { type: "driver", name: `shared ${stamp} driver` })).driver;

  await page.goto("./");
  const fixture = await addFixtures(page, `Shared ${stamp}`);
  await runSession(page);
  await expect(sessionCard(page, fixture)).toBeVisible();

  await syncWith(page);
  const synced = page.getByRole("status").filter({ hasText: "Synced with the timer." });
  await expect(synced).toBeVisible();
  await expect(synced).toContainText("Added 1 session, 1 car and 1 location.");
  await expect(synced).toContainText("Combined 1 driver with ones of the same name on the timer.");
  await expect(page.getByText("Last backup or sync: today.")).toBeVisible();

  // The timer has the phone's session, under its own driver.
  const timer = await timerApi("GET", "/api/data");
  const sharedNames = timer.drivers.filter((d: { name: string }) => d.name.toLowerCase() === shared.name.toLowerCase());
  expect(sharedNames.map((d: { id: string }) => d.id)).toEqual([shared.id]);
  expect(timer.sessions.filter((s: { driverId: string }) => s.driverId === shared.id)).toHaveLength(1);

  // The phone has the timer's driver, and uses the timer's record for the one they share.
  const ids = await phoneDriverIds(page);
  expect(ids).toContain(timerOnly.id);
  expect(ids).toContain(shared.id);
  // The driver Practice had selected went into the timer's, so it asks again, and offers the timer's drivers.
  await page.getByRole("tab", { name: "Practice" }).click();
  await pickSelect(page, "Select Driver", timerOnly.name);

  await syncWith(page);
  await expect(synced).toContainText("Nothing new: the timer already has everything on this phone.");
  await expect(synced).toContainText("Nothing new: this phone already has everything on the timer.");
});

test("explains what to try when the timer can't be reached", async ({ page }) => {
  await page.goto("./");
  await syncWith(page, "http://127.0.0.1:3999");
  const problem = page.getByRole("alert").filter({ hasText: "Couldn't reach the timer." });
  await expect(problem).toBeVisible();
  await expect(problem).toContainText("Use backup files instead");
});
