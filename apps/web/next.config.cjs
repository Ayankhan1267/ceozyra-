const base = require('../../next.config.base.js');

/** @type {import('next').NextConfig} */
module.exports = {
  ...base,
  output: 'standalone',
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
