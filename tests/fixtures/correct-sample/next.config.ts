// Gold-standard Next.js 16 config. Demonstrates:
// 1. cacheComponents: true (replaces experimental.ppr / dynamicIO / useCache)
// 2. images.remotePatterns (not deprecated images.domains)
// 3. No custom webpack config (Turbopack is the default in v16)
// 4. No experimental flags that were collapsed into cacheComponents
import type { NextConfig } from "next";

const config: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.example.com",
        pathname: "/images/**",
      },
    ],
    qualities: [50, 75, 90],
  },
};

export default config;
