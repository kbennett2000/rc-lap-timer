// Shared by the cloud features' browser tests (cloud.spec.ts), which run against a local Supabase (supabase/config.toml).

import { expect, type Page } from "@playwright/test";
import { openDataTab } from "./phone-helpers";

// The local Supabase's API, and the mail catcher that gets its emails.
export const CLOUD_URL = process.env.E2E_CLOUD_URL ?? "http://127.0.0.1:54321";
const MAIL_URL = process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324";

let accounts = 0;
// A new email address each time, so each test has its own account.
export const newEmail = () => `cloud-${Date.now().toString(36)}-${++accounts}@example.com`;

async function emailsTo(address: string): Promise<{ ID: string }[]> {
  const response = await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  return (await response.json()).messages ?? [];
}

// Clicks `send` and returns the code in the email it sends, newer than any already sent to the address.
export async function emailedCode(address: string, send: () => Promise<void>): Promise<string> {
  const before = (await emailsTo(address)).length;
  await send();
  let latest: { ID: string } | undefined;
  await expect
    .poll(async () => {
      const emails = await emailsTo(address);
      latest = emails[0];
      return emails.length;
    })
    .toBeGreaterThan(before);
  const email = await (await fetch(`${MAIL_URL}/api/v1/message/${latest!.ID}`)).json();
  const code = String(email.Text).match(/\b\d{6,10}\b/)?.[0];
  expect(code, "the code in the email").toBeTruthy();
  return code!;
}

export async function signIn(page: Page, email: string) {
  await openDataTab(page);
  await page.getByLabel("Email").fill(email);
  const code = await emailedCode(email, () => page.getByRole("button", { name: "Send code" }).click());
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
}

export async function syncNow(page: Page) {
  await openDataTab(page);
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Synced with your account." })).toBeVisible();
}
