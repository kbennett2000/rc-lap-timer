// Checks that each build only contains its own code (see next.config.js and src/data/index.ts). Run after a build:
//   node scripts/check-bundles.mjs pi                 (after npm run build)
//   node scripts/check-bundles.mjs standalone         (after npm run build:pages)
//   node scripts/check-bundles.mjs standalone-cloud   (after npm run build:pages with a cloud service, docs/cloud.md)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PI_ONLY = { "race mode": /\/api\/races/, "the Pi's System Settings": /\/api\/system/ };
// The Supabase library, and the app's own cloud code.
const CLOUD = { "the cloud features (Supabase)": /GoTrueClient|rc-lap-timer-cloud/ };

const CHECKS = {
  pi: {
    dir: ".next/static",
    forbidden: {
      "the phone's on-device store (Dexie)": /DatabaseClosedError/,
      "the service worker (Workbox)": /workbox/i,
      ...CLOUD,
    },
  },
  standalone: { dir: "out/_next", forbidden: { ...PI_ONLY, ...CLOUD } },
  "standalone-cloud": { dir: "out/_next", forbidden: PI_ONLY, required: CLOUD },
};

const target = process.argv[2];
const check = CHECKS[target];
if (!check) {
  console.error("Usage: node scripts/check-bundles.mjs pi|standalone|standalone-cloud");
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
for (const [what, pattern] of Object.entries(check.required ?? {})) {
  if (!files.some((file) => pattern.test(readFileSync(file, "utf8")))) {
    failed = true;
    console.error(`The ${target} build doesn't contain ${what}`);
  }
}
if (failed) process.exit(1);
console.log(`The ${target} build contains only its own code (${files.length} files checked).`);
