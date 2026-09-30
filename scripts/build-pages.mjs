// Builds the phone-only app as a static site in out/, for GitHub Pages (npm run build:pages): the Next export, then
// the web app manifest (so phones can install it) and a service worker (so it works offline).
// PAGES_BASE_PATH is the path the site is served under: GitHub Actions passes the repository's, and it defaults to
// /rc-lap-timer. Setting the variables here, not in package.json, keeps the script working on Windows.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { generateSW } from "workbox-build";

const require = createRequire(import.meta.url);
const basePath = (process.env.PAGES_BASE_PATH ?? "/rc-lap-timer").replace(/\/$/, "");
const env = { ...process.env, NEXT_PUBLIC_TARGET: "standalone", PAGES_BASE_PATH: basePath };

const build = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);

// Paths in the manifest are relative to it, except id: a relative id would resolve against the site's origin, which
// every project site on the same GitHub account shares.
const manifest = {
  id: `${basePath}/`,
  name: "RC Lap Timer",
  short_name: "Lap Timer",
  description: "Time RC car laps with your phone: tap, or let the camera spot the car.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync("out/manifest.webmanifest", `${JSON.stringify(manifest, null, 2)}\n`);

// The service worker keeps a copy of the whole app, so it opens without a connection. A new version waits until the
// app offers to reload (src/pwa/app-shell.tsx), so a run is never cut short by an update.
const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const { count, size, warnings } = await generateSW({
  globDirectory: "out",
  globPatterns: ["**/*.{html,txt,js,css,webmanifest,png,svg,ico,woff,woff2}"],
  globIgnores: ["404.html", "404/**", "sw.js"],
  swDest: "out/sw.js",
  modifyURLPrefix: { "": `${basePath}/` },
  navigateFallback: `${basePath}/index.html`,
  navigateFallbackAllowlist: [new RegExp(`^${escapedBase}/`)],
  // Next's hashed files never change, so they need no cache-busting.
  dontCacheBustURLsMatching: /\/_next\/static\//,
  ignoreURLParametersMatching: [/^_rsc$/, /^utm_/],
  cleanupOutdatedCaches: true,
  skipWaiting: false,
  clientsClaim: false,
  inlineWorkboxRuntime: true,
  sourcemap: false,
  mode: "production",
});
if (warnings.length > 0) {
  console.error(`Service worker warnings:\n${warnings.join("\n")}`);
  process.exit(1);
}

console.log(
  `\nBuilt the phone app in out/ for ${basePath || "/"}: ${count} files (${Math.round(size / 1024)} kB) cached for offline use`,
);
