// Browser tests for the cloud features (docs/cloud.md): accounts, cloud sync, shared tracks and leaderboards, in the
// phone app built with a local Supabase, as CI's cloud job runs them. The steps are in the README (Development & Contributing → Checks): npx supabase@2.119.0 start, then
// build the phone app with its URL and publishable key, serve it (npm run serve:pages), and run
// E2E_TARGET=cloud npm run test:e2e. Every test signs up with a new email address, so each has its own account.

import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { CLOUD_URL, emailedCode, newEmail, signIn, syncNow } from "./cloud-helpers";
import { addFixtures, openDataTab, runSession, sessionCard } from "./phone-helpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

// Another phone: a browser with nothing in it.
async function anotherPhone(browser: Browser, testInfo: TestInfo) {
  const { baseURL, viewport, hasTouch } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, hasTouch });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("./");
  return { context, page };
}

test("signs in with an emailed code, and syncs both ways between two phones", async ({ page, browser }, testInfo) => {
  const email = newEmail();
  await page.goto("./");
  const first = await addFixtures(page, "First Phone");
  await runSession(page);
  await expect(sessionCard(page, first)).toBeVisible();

  // A wrong code, then the right one.
  await openDataTab(page);
  await page.getByLabel("Email").fill(email);
  const code = await emailedCode(email, () => page.getByRole("button", { name: "Send code" }).click());
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /That code is wrong or has expired/ })).toBeVisible();
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByText("Last synced: never.")).toBeVisible();
  await syncNow(page);
  await expect(page.getByRole("status")).toContainText(
    /In your account:\s*Added 1 session, 1 driver, 1 car and 1 location\./,
  );
  await expect(page.getByText("Last synced: today.")).toBeVisible();
  // As good as a backup.
  await expect(page.getByText("Last backup or sync: today.")).toBeVisible();

  const { context, page: other } = await anotherPhone(browser, testInfo);
  const second = await addFixtures(other, "Second Phone");
  await runSession(other);
  await signIn(other, email);
  await syncNow(other);
  await expect(other.getByRole("status")).toContainText(
    /On this phone:\s*Added 1 session, 1 driver, 1 car and 1 location\./,
  );
  await other.getByRole("tab", { name: "Practice" }).click();
  await expect(sessionCard(other, first), "the first phone's session, on the second").toBeVisible();

  await syncNow(page);
  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(sessionCard(page, second), "the second phone's session, on the first").toBeVisible();

  // A second sync changes nothing.
  await syncNow(page);
  await expect(page.getByRole("status")).toContainText(/In your account:\s*Nothing new.*On this phone:\s*Nothing new/);

  // Signing out leaves the phone's data.
  await openDataTab(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(sessionCard(page, second)).toBeVisible();
  await context.close();
});

test("keeps timing when the cloud can't be reached", async ({ page }) => {
  await page.goto("./");
  await signIn(page, newEmail());
  await page.route(`${CLOUD_URL}/**`, (route) => route.abort("internetdisconnected"));

  await page.getByRole("button", { name: "Sync now" }).click();
  // After the Supabase library's retries: 1, 2 and 4 seconds apart.
  await expect(page.getByRole("alert").filter({ hasText: /Couldn't reach the cloud service/ })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("tab", { name: "Practice" }).click();
  const fixture = await addFixtures(page, "Offline");
  await runSession(page);
  await expect(sessionCard(page, fixture)).toBeVisible();
  await expect(page.getByText("Session not saved")).toHaveCount(0);

  // Still signed in after a reload, without the cloud.
  await page.reload();
  await openDataTab(page);
  await expect(page.getByText(/Signed in as/)).toBeVisible();
});

test("deletes the account and what it holds, and keeps the phone's data", async ({ page }) => {
  const email = newEmail();
  await page.goto("./");
  const fixture = await addFixtures(page, "Delete");
  await runSession(page);
  await signIn(page, email);
  await syncNow(page);

  await page.getByRole("button", { name: "Delete account…" }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await page.getByRole("button", { name: "Delete account…" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await page.getByRole("tab", { name: "Practice" }).click();
  await expect(sessionCard(page, fixture), "the session, still on the phone").toBeVisible();

  // The same address makes a new, empty account: the old one's data went with it.
  await signIn(page, email);
  await syncNow(page);
  await expect(page.getByRole("status")).toContainText(
    /In your account:\s*Added 1 session, 1 driver, 1 car and 1 location\./,
  );
});

// A session whose best lap is about `lapMs`, from Practice's setup. Stopping counts as a lap too, a slower one.
async function lapOf(page: Page, lapMs: number) {
  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(lapMs);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(lapMs + 1000);
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
}

// The lap times on a track's leaderboard, in ms, fastest first.
async function leaderboardTimes(page: Page): Promise<number[]> {
  const rows = await page.getByRole("list", { name: "Leaderboard" }).getByRole("listitem").allTextContents();
  return rows.map((row) => {
    const [, minutes, seconds, ms] = row.match(/(\d\d):(\d\d)\.(\d\d\d)/)!;
    return (Number(minutes) * 60 + Number(seconds)) * 1000 + Number(ms);
  });
}

async function openTrack(page: Page, name: string) {
  await page.getByRole("tab", { name: "Tracks" }).click();
  await page.getByPlaceholder("Search tracks").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByText("Each driver's best lap")).toBeVisible();
}

test("posts sessions to a new track's leaderboard, which anyone can see", async ({ page, browser }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Post to leaderboard" }), "signed out, no posting").toHaveCount(0);
  const fixture = await addFixtures(page, `Board ${Date.now().toString(36)}`);
  await lapOf(page, 900);
  await signIn(page, newEmail());

  // Post the session to a new track named after its location.
  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Post to leaderboard" }).click();
  const panel = page.locator("div.rounded.border").filter({ hasText: "Post to a track's leaderboard" });
  await expect(panel).toContainText(`Everyone will be able to see: ${fixture.driver}, ${fixture.car}, best lap`);
  await panel.getByRole("combobox").click();
  await page.getByRole("option", { name: "A new track…" }).click();
  await expect(panel.getByLabel("New track's name")).toHaveValue(fixture.location);
  await panel.getByLabel("Where it is (optional)").fill("Test Town");
  await panel.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(`On the leaderboard at ${fixture.location}.`)).toBeVisible();

  await openTrack(page, fixture.location);
  await expect(page.getByText("Test Town")).toBeVisible();
  const [first] = await leaderboardTimes(page);
  expect(first).toBeGreaterThanOrEqual(900);
  await expect(page.getByRole("button", { name: "Remove my post" })).toBeVisible();

  // A faster session at the same location goes to the same track, and replaces the driver's place.
  await lapOf(page, 300);
  await page.getByRole("button", { name: "Post to leaderboard" }).first().click();
  await expect(panel.getByRole("combobox")).toHaveText(`${fixture.location} (Test Town)`);
  await panel.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(`On the leaderboard at ${fixture.location}.`)).toHaveCount(2);
  await openTrack(page, fixture.location);
  // The board shows what it had while it reloads.
  await expect
    .poll(async () => {
      const times = await leaderboardTimes(page);
      return times.length === 1 && times[0] < first;
    }, "one place per driver, now the faster lap")
    .toBe(true);
  const [best] = await leaderboardTimes(page);

  // Anyone can see it, signed out.
  const { context, page: other } = await anotherPhone(browser, testInfo);
  await openTrack(other, fixture.location);
  expect(await leaderboardTimes(other)).toEqual([best]);
  await expect(other.getByText(fixture.driver)).toBeVisible();
  await expect(other.getByRole("button", { name: "Remove my post" })).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Add a track" })).toHaveCount(0);
  await context.close();

  // Taking down the faster post leaves the slower one; then that one goes too, from its session.
  await page.getByRole("button", { name: "Remove my post" }).click();
  await expect.poll(() => leaderboardTimes(page)).toEqual([first]);
  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Remove from leaderboard" }).click();
  await expect(page.getByRole("button", { name: "Post to leaderboard" })).toHaveCount(2);
  await openTrack(page, fixture.location);
  await expect(page.getByText("No laps posted yet.")).toBeVisible();

  // Its creator can delete it once it's empty.
  await page.getByRole("button", { name: "Delete track" }).click();
  await expect(page.getByPlaceholder("Search tracks")).toBeVisible();
  await page.getByPlaceholder("Search tracks").fill(fixture.location);
  await expect(page.getByText("No tracks match.")).toBeVisible();
});

test("shows the tracks when the cloud can't be reached as an error to retry", async ({ page }) => {
  await page.route(`${CLOUD_URL}/**`, (route) => route.abort("internetdisconnected"));
  await page.goto("./");
  await page.getByRole("tab", { name: "Tracks" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Couldn't reach the cloud service/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.unroute(`${CLOUD_URL}/**`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Couldn't reach/ })).toHaveCount(0);
});
