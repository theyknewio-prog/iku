import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hentaimama.io https://hentai.tv https://animeidhentai.com https://watchhentai.net https://hentaiworld.tv https://hentaigasm.com https://hentaicity.com",
      "media-src 'self' blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com",
      "connect-src 'self' https://cdn.donmai.us https://danbooru.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.donmai.us" },
      { protocol: "https", hostname: "media.gelbooru.com" },
      { protocol: "https", hostname: "img2.gelbooru.com" },
      { protocol: "https", hostname: "img3.gelbooru.com" },
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
};

export default nextConfig;
