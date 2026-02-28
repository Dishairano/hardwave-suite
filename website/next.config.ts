import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/erp',
        permanent: true,
      },
      {
        source: '/admin/:path*',
        destination: '/erp',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
