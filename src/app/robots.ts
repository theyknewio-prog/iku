import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

// Count total videos to generate the right number of sitemap references
function getWatchSitemapCount(): number {
  const DATA_DIR = path.join(process.cwd(), "src/data");
  const MAX_PER_SITEMAP = 45000;
  let total = 0;

  const countJSON = (file: string) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8")).length;
    } catch { return 0; }
  };

  total += countJSON("videos.json");
  total += countJSON("gelbooru-videos.json");
  total += countJSON("rule34-videos.json");
  total += countJSON("rule34video-videos.json");
  total += countJSON("wp-hentai-videos.json");

  return Math.ceil(total / MAX_PER_SITEMAP);
}

export default function robots(): MetadataRoute.Robots {
  const sitemapCount = getWatchSitemapCount();

  // Build dynamic sitemap list
  const sitemaps: string[] = [
    "https://iku.gg/sitemap.xml",
  ];

  // Add all watch sitemap chunks dynamically
  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push(`https://iku.gg/watch/sitemap/${i}.xml`);
  }

  // Add other section sitemaps
  sitemaps.push(
    "https://iku.gg/tag/sitemap.xml",
    "https://iku.gg/character/sitemap.xml",
    "https://iku.gg/series/sitemap.xml",
  );

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/watch/", "/tag/", "/character/", "/series/", "/trending", "/new", "/tags", "/blog/", "/glossary/"],
      disallow: ["/api/", "/_next/", "/feed", "/v/", "/favorites", "/history", "/settings"],
    },
    sitemap: sitemaps,
  };
}
