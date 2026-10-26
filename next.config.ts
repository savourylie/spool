import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project. Without it Turbopack walks
  // up and can pick a parent lockfile (e.g. ~/package-lock.json) as the root.
  // Note: don't use `__dirname` here — Next's config loader resolves it to the
  // environment name ("development"), not this directory.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
