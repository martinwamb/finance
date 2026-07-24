import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — the server also has a stray
  // package-lock.json in the admin home directory, which otherwise makes
  // Turbopack guess the wrong project root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
