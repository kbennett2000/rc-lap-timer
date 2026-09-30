/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Removed once `npm run lint` is clean.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
