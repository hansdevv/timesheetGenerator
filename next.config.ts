import type { NextConfig } from "next";

// When building for GitHub Pages, the site is served at /<repo-name>/
// Set NEXT_PUBLIC_BASE_PATH in CI to override (e.g. /timesheetGenerator)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: {
    unoptimized: true,
  },
  // Dev-only: Turbopack CSS loader
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
