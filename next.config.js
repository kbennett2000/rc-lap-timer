// Two builds from one tree, picked by NEXT_PUBLIC_TARGET (see src/platform/capabilities.ts):
// - "pi" (the default): the app the Raspberry Pi serves, with its API routes. Those are the src/app/api/**/route.pi.ts
//   files, which only this build treats as routes.
// - "standalone": the phone-only app, a static site for GitHub Pages under PAGES_BASE_PATH (see
//   scripts/build-pages.mjs). It has no server, so it never sees the route files.
const target = process.env.NEXT_PUBLIC_TARGET;
if (target && target !== "pi" && target !== "standalone") {
  throw new Error(`NEXT_PUBLIC_TARGET must be "pi" or "standalone", not "${target}"`);
}
const standalone = target === "standalone";
const basePath = standalone ? (process.env.PAGES_BASE_PATH ?? "") : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Always defined, so the build can drop the other target's code: Next only inlines NEXT_PUBLIC_ variables that are
  // set, and the Pi build leaves this one unset.
  env: { NEXT_PUBLIC_TARGET: standalone ? "standalone" : "pi", NEXT_PUBLIC_BASE_PATH: basePath },
  ...(standalone
    ? {
        output: "export",
        basePath,
        // Pages are served as <path>/index.html, which GitHub Pages handles without rewrites.
        trailingSlash: true,
      }
    : { pageExtensions: ["pi.ts", "tsx", "ts", "jsx", "js"] }),
};

module.exports = nextConfig;
