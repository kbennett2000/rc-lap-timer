// Checks that each build only contains its own code (see next.config.js and src/data/index.ts). Run after a build:
//   node scripts/check-bundles.mjs pi           (after npm run build)
//   node scripts/check-bundles.mjs standalone   (after npm run build:pages)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKS = {
  pi: {
    dir: ".next/static",
    forbidden: {
      "the phone's on-device store (Dexie)": /DatabaseClosedError/,
      "the service worker (Workbox)": /workbox/i,
    },
  },
  standalone: {
    dir: "out/_next",
    forbidden: { "race mode": /\/api\/races/, "the Pi's System Settings": /\/api\/system/ },
  },
};

const target = process.argv[2];
const check = CHECKS[target];
if (!check) {
  console.error("Usage: node scripts/check-bundles.mjs pi|standalone");
  process.exit(2);
}

const files = readdirSync(check.dir, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".js"))
  .map((file) => join(check.dir, file));
if (files.length === 0) {
  console.error(`No JavaScript in ${check.dir}: build the ${target} app first.`);
  process.exit(2);
}

let failed = false;
for (const [what, pattern] of Object.entries(check.forbidden)) {
  const found = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
  if (found.length > 0) {
    failed = true;
    console.error(`The ${target} build contains ${what}: ${found.join(", ")}`);
  }
}
if (failed) process.exit(1);
console.log(`The ${target} build contains only its own code (${files.length} files checked).`);
