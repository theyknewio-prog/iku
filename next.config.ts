import type { NextConfig } from "next";

// Note: Content-Security-Policy is now set per-request by src/middleware.ts
// so it can include a nonce. Static security headers stay here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // X-XSS-Protection retiré 2026-04-23 (V11): deprecated since ~2019, can
  // reintroduce XSS in old Edge variants. CSP + frame-ancestors cover us.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.donmai.us" },
      { protocol: "https", hostname: "gelbooru.com" },
      { protocol: "https", hostname: "media.gelbooru.com" },
      { protocol: "https", hostname: "img2.gelbooru.com" },
      { protocol: "https", hostname: "img3.gelbooru.com" },
      { protocol: "https", hostname: "img4.gelbooru.com" },
      // CrakRevenue creative CDN — affiliate banner thumbnails for AffiliateCard
      { protocol: "https", hostname: "www.imglnkx.com" },
      { protocol: "https", hostname: "imglnkx.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Legacy routes linked from old emails / SEO farms / shares.
      { source: "/premium", destination: "/pricing", permanent: true },
      { source: "/characters", destination: "/character", permanent: true },
      {
        source: "/characters/:slug",
        destination: "/character/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
