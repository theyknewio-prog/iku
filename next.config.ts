import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.donmai.us" },
      { protocol: "https", hostname: "media.gelbooru.com" },
      { protocol: "https", hostname: "img2.gelbooru.com" },
      { protocol: "https", hostname: "img3.gelbooru.com" },
    ],
  },
};

export default nextConfig;
