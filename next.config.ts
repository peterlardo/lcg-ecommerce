import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
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
