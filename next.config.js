// NEXT_PUBLIC_TARGET picks the build: "pi" (the default) or "standalone", the phone-only app (see
// src/platform/capabilities.ts). Anything else is a typo that would quietly build the Pi app, so it stops the build.
const target = process.env.NEXT_PUBLIC_TARGET;
if (target && target !== "pi" && target !== "standalone") {
  throw new Error(`NEXT_PUBLIC_TARGET must be "pi" or "standalone", not "${target}"`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
