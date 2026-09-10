const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  // Tenant-aware middleware handles routing
  // This is a base config, apps can override
};

module.exports = nextConfig;
