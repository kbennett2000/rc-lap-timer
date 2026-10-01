// Browser tests for the cloud features (docs/cloud.md): the phone app built with a local Supabase, as CI's cloud job
// runs them. The steps are in the README (Development & Contributing → Checks): npx supabase@2.119.0 start, then
// build the phone app with its URL and publishable key, serve it (npm run serve:pages), and run
// E2E_TARGET=cloud npm run test:e2e. Every test signs up with a new email address, so each has its own account.

import { expect, test, type Browser, type TestInfo } from "@playwright/test";
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
