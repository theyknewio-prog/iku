import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/watch/", "/tag/", "/trending", "/new", "/tags"],
      disallow: ["/api/", "/_next/", "/feed", "/v/"],
    },
    sitemap: [
      "https://iku.gg/sitemap.xml",
      "https://iku.gg/watch/sitemap.xml",
      "https://iku.gg/tag/sitemap.xml",
    ],
  };
}
