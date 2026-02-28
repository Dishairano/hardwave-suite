import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ["@hardwave/shared", "@hardwave/ui", "@hardwave/analyser-engine"],
};

export default nextConfig;
