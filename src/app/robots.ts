import type { MetadataRoute } from "next";
import pool from "@/lib/db";

async function getWatchSitemapCount(): Promise<number> {
  const MAX_PER_SITEMAP = 45000;
  const { rows } = await pool.query("SELECT COUNT(*) as total FROM videos");
  const total = parseInt(rows[0].total, 10);
  return Math.ceil(total / MAX_PER_SITEMAP);
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemapCount = await getWatchSitemapCount();

  const sitemaps: string[] = [
    "https://iku.gg/sitemap.xml",
  ];

  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push(`https://iku.gg/watch/sitemap/${i}.xml`);
  }

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
