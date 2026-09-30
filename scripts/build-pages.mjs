// Builds the phone-only app as a static site in out/, for GitHub Pages (npm run build:pages).
// PAGES_BASE_PATH is the path the site is served under: GitHub Actions passes the repository's, and it defaults to
// /rc-lap-timer. Setting the variables here, not in package.json, keeps the script working on Windows.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const basePath = (process.env.PAGES_BASE_PATH ?? "/rc-lap-timer").replace(/\/$/, "");
const env = { ...process.env, NEXT_PUBLIC_TARGET: "standalone", PAGES_BASE_PATH: basePath };

const build = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);

console.log(`\nBuilt the phone app in out/ for ${basePath || "/"}`);
