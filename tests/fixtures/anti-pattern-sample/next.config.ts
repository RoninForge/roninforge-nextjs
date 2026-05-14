// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. experimental.ppr (removed in v16, collapsed into cacheComponents)
// 2. experimental.dynamicIO (removed in v16, collapsed into cacheComponents)
// 3. images.domains (deprecated in v16, use remotePatterns)
// 4. Custom webpack config without --webpack flag (Turbopack is the v16 default; this breaks next build)
// 5. "next lint" script in package.json (removed in v16)

import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    ppr: true,
    dynamicIO: true,
    useCache: true,
  },
  images: {
    domains: ['cdn.example.com', 'images.example.com'],
  },
  webpack: (cfg) => {
    cfg.resolve.alias['~'] = require('path').resolve(__dirname);
    return cfg;
  },
};

export default config;
