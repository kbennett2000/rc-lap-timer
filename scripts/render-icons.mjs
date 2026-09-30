// Renders public/icons/icon.svg into the PNG icons the app ships (run again after changing the drawing):
//   node scripts/render-icons.mjs
// Manifest icons go in public/icons; the browser tab and Apple touch icons are Next's src/app/icon.png and
// src/app/apple-icon.png, which Next links with the right base path in both builds.

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const OUTPUTS = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable-512.png", 512],
  ["src/app/icon.png", 64],
  ["src/app/apple-icon.png", 180],
];

const browser = await chromium.launch();
for (const [path, size] of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log(`${path} (${size}×${size})`);
}
await browser.close();
