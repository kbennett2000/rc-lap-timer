///** @type {import('next').NextConfig} */
//const nextConfig = {
//  reactStrictMode: true,
//  swcMinify: true,
//  typescript: {
//    ignoreBuildErrors: true,
//  },
//  eslint: {
//    ignoreDuringBuilds: true,
//  },
//};
//module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Add the headers configuration here
  headers: async () => {
    return [
      {
        source: "/api/current-session/summary",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
