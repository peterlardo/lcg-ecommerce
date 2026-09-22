import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ]
  },
  serverExternalPackages: [
    "prisma",
    "@prisma/client",
    ".prisma/client",
    "sharp",
    "nodemailer",
    "stripe",
    "bcryptjs",
  ],
};

export default nextConfig;
