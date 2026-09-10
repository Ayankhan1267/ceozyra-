const base = require('../../next.config.base.js');
module.exports = { ...base, output: 'standalone', eslint: { ignoreDuringBuilds: true } };
