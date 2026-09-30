// Retakes the README's screenshots of the app (images/*.jpg) with sample data, at a phone's width. Run it by hand
// after changing a screen they show; the README says which screens are which. Needs Playwright's Chromium
// (npx playwright install chromium) and one of the builds running:
//   node scripts/screenshots.mjs phone [url]   the phone app (npm run build:pages && npm run serve:pages),
//                                               default http://127.0.0.1:3100/rc-lap-timer/
//   node scripts/screenshots.mjs timer [url]   the Pi build, with its database (see the README's Checks),
//                                               default http://127.0.0.1:3100
// The timer's shots add sample data to its database, so use a test database, not a real timer's.
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const [target, url] = process.argv.slice(2);
if (target !== "phone" && target !== "timer") {
  console.error("Usage: node scripts/screenshots.mjs phone|timer [url]");
  process.exit(1);
}
const base = url ?? (target === "phone" ? "http://127.0.0.1:3100/rc-lap-timer/" : "http://127.0.0.1:3100");
const WIDTH = 400;

// Sample data: two drivers with a car each, two tracks, and today's sessions (the screens show today's at first).
function sampleBundle() {
  const now = Date.now();
  const at = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
  const stamp = at(120);
  const record = (fields) => ({ id: randomUUID(), createdAt: stamp, updatedAt: stamp, ...fields });
  const drivers = [record({ name: "Kris" }), record({ name: "Sam" })];
  const cars = [
    record({ name: "Slash 4x4", driverId: drivers[0].id, defaultCarNumber: null }),
    record({ name: "Mini-T 2.0", driverId: drivers[1].id, defaultCarNumber: null }),
  ];
  const locations = [record({ name: "Backyard Oval" }), record({ name: "Parking Lot" })];
  const sessions = [
    [0, 0, 95, [14210, 13580, 13122, 13904, 12877, 13311, 12950], [{ lapNumber: 3, count: 1 }], "Softer rear springs"],
    [1, 0, 80, [15120, 14650, 14433, 14892, 14120, 14378], [], null],
    [0, 1, 60, [11870, 11532, 11210, 11644, 11031], [{ lapNumber: 4, count: 2 }], "Dusty, low grip"],
    [1, 1, 40, [12450, 12011, 11893, 12304, 11760], [], null],
  ].map(([driver, location, minutesAgo, lapTimes, penalties, notes]) => {
    const date = at(minutesAgo);
    return {
      id: randomUUID(),
      date,
      driverId: drivers[driver].id,
      driverName: drivers[driver].name,
      carId: cars[driver].id,
      carName: cars[driver].name,
      locationId: locations[location].id,
      locationName: locations[location].name,
      laps: lapTimes.map((lapTime, i) => ({ lapNumber: i + 1, lapTime })),
      penalties,
      totalTime: lapTimes.reduce((a, b) => a + b, 0),
      totalLaps: lapTimes.length,
      notes,
      createdAt: date,
      updatedAt: date,
    };
  });
  return {
    format: "rc-lap-timer",
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    deviceId: randomUUID(),
    data: { drivers, cars, locations, sessions, motionSettings: [] },
    tombstones: [],
    aliases: [],
  };
}

// The innermost card (or other rounded box) holding this text.
const boxWith = (page, text) =>
  page
    .locator("div[class*='rounded']")
    .filter({ has: page.getByText(text, { exact: true }) })
    .last();

// A part of the screen, without the bottom bar over it. `height` cuts a long box short.
async function shoot(locator, name, height) {
  await locator.scrollIntoViewIfNeeded();
  const style = ".fixed.bottom-0 { display: none !important; }";
  const box = height ? await locator.boundingBox() : null;
  if (box) {
    await locator.page().screenshot({
      path: `images/${name}`,
      type: "jpeg",
      quality: 85,
      style,
      fullPage: true,
      clip: { x: box.x, y: box.y + (await locator.page().evaluate(() => window.scrollY)), width: box.width, height },
    });
  } else {
    await locator.screenshot({ path: `images/${name}`, type: "jpeg", quality: 85, animations: "disabled", style });
  }
  console.log(`images/${name}`);
}

async function pick(page, placeholder, option) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const browser = await chromium.launch({
  // Chromium's own test camera (a moving pattern) stands in for the phone's.
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 }, hasTouch: true });
page.on("dialog", (dialog) => dialog.accept());
await page.goto(base);
const bundle = sampleBundle();

if (target === "phone") {
  // Restore the sample data the way a user would.
  await page.getByRole("tab", { name: "Manager" }).click();
  await page.getByRole("tab", { name: /Data/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "rc-lap-timer-sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByText("Backup restored.").waitFor();
  // The reminder to save a backup isn't what these screenshots are about.
  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("tab", { name: "Manager" }).click();

  await page.getByRole("tab", { name: /Drivers/ }).click();
  await shoot(boxWith(page, "Application Configuration"), "appConfig.jpg");

  await page.getByRole("tab", { name: "Practice" }).click();
  await pick(page, "Select Driver", "Kris");
  await pick(page, "Select Car", "Slash 4x4");
  await pick(page, "Select Location", "Backyard Oval");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "images/navigation.jpg", type: "jpeg", quality: 85 });
  console.log("images/navigation.jpg");

  await page.getByLabel("Time Using Motion Detection").click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByTestId("frame-stats").waitFor();
  await page.waitForTimeout(1500);
  const detector = page.getByRole("button", { name: "Rotate preview" }).locator("xpath=../..");
  await shoot(detector, "cameraControls.jpg");
  await page.getByRole("button", { name: "Stop Preview" }).click();

  await page.getByRole("tab", { name: /Session/ }).click();
  await page.waitForTimeout(500);
  await shoot(boxWith(page, "Previous Sessions"), "previousSessions.jpg", 900);
} else {
  const api = async (method, path, body) => {
    const response = await fetch(new URL(path, base), {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  await api("POST", "/api/sync", { bundle });
  // A session running on another phone, for Session Mgmt's live view.
  await api("POST", "/api/current-session/truncate", {});
  const { session } = await api("POST", "/api/current-session", {
    driverName: "Sam",
    carName: "Mini-T 2.0",
    locationName: "Parking Lot",
    lapCount: 10,
  });
  for (const [i, lapTime] of [12384, 11902, 11755].entries()) {
    await api("PUT", "/api/current-session", {
      action: "addLap",
      sessionId: session.id,
      lapNumber: i + 1,
      lapTime,
      penaltyCount: i === 1 ? 1 : 0,
    });
  }
  await page.reload();

  await shoot(page.getByRole("radiogroup").locator("xpath=.."), "timingModeSelection.jpg");

  await page.getByRole("tab", { name: /Session/ }).click();
  await page.waitForTimeout(1500);
  await shoot(boxWith(page, "Current Session"), "currentSession.jpg");
  await shoot(boxWith(page, "Request a Session"), "requestASession.jpg");
  await api("POST", "/api/current-session/truncate", {});
}

await browser.close();
