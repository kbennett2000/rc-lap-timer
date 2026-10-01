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

// Accounts, cloud sync, shared tracks and leaderboards (docs/cloud.md) are in the phone app only when it's built with a
// Supabase project's URL and key, as the Pages workflow does when the CLOUD_URL and CLOUD_KEY repository variables are
// set. Otherwise they're left out of the build, and the Pi, which has no internet, never has them.
const cloudUrl = standalone ? (process.env.NEXT_PUBLIC_CLOUD_URL ?? "").trim().replace(/\/+$/, "") : "";
const cloudKey = standalone ? (process.env.NEXT_PUBLIC_CLOUD_KEY ?? "").trim() : "";
if (Boolean(cloudUrl) !== Boolean(cloudKey)) {
  throw new Error("Set both NEXT_PUBLIC_CLOUD_URL and NEXT_PUBLIC_CLOUD_KEY for the cloud features, or neither");
}
if (cloudUrl && !/^https?:\/\/[^/]+$/.test(cloudUrl)) {
  throw new Error(
    `NEXT_PUBLIC_CLOUD_URL must be a Supabase project's URL, like https://abcd.supabase.co, not "${cloudUrl}"`,
  );
}
const cloudPrivacyUrl = cloudUrl ? (process.env.NEXT_PUBLIC_CLOUD_PRIVACY_URL ?? "").trim() : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Always defined, so the build can drop the code it doesn't use: Next only inlines NEXT_PUBLIC_ variables that are
  // set, and the Pi build leaves NEXT_PUBLIC_TARGET unset.
  env: {
    NEXT_PUBLIC_TARGET: standalone ? "standalone" : "pi",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_CLOUD_URL: cloudUrl,
    NEXT_PUBLIC_CLOUD_KEY: cloudKey,
    NEXT_PUBLIC_CLOUD_PRIVACY_URL: cloudPrivacyUrl,
  },
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
