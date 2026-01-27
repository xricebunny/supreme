/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    // magic-sdk@28 has broken internal imports (Wallets/Events missing from @magic-sdk/types).
    // Downgrade missing exports from errors to warnings so the build can succeed.
    config.module.strictExportPresence = false;
    return config;
  },
};

module.exports = nextConfig;
