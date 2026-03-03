import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion renderer/bundler are Node.js-only packages with native deps.
  // They must not be bundled by webpack — keep them as external requires.
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
  ],
};

export default nextConfig;
