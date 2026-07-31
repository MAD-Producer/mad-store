import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next.js 默认会将 mongodb 外置；EdgeOne Functions 需要把它打进服务端产物。
  transpilePackages: ["mongodb"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
