import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the dev badge out of local screenshots and scripts/capture-scene.mjs posters.
  devIndicators: false,
};

export default nextConfig;
