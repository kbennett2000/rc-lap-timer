// Shared by the phone-only app's browser tests (standalone.spec.ts, sync.spec.ts).

import { expect, type Page } from "@playwright/test";

export type Fixture = { driver: string; car: string; location: string };

export async function pickSelect(page: Page, placeholder: string, optionText: string) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

// Adds a driver, a car and a location from Practice's setup, which selects each one as it's made.
export async function addFixtures(page: Page, label: string): Promise<Fixture> {
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
export const sessionCard = (page: Page, fixture: Fixture) =>
  page.getByText(`Driver: ${fixture.driver} - Car: ${fixture.car}`);

export async function runSession(page: Page) {
  await page.getByRole("button", { name: "Start Lap Timer" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Record Lap" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Stop Lap Timer" }).click();
}

export async function openDataTab(page: Page) {
  await page.getByRole("tab", { name: "Manager" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
}
