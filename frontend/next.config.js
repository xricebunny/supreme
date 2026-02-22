/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    // magic-sdk has broken internal imports (@magic-sdk/types missing exports).
    // Downgrade missing exports from errors to warnings so the build can succeed.
    config.module.strictExportPresence = false;
    return config;
  },
};

module.exports = nextConfig;
