import type { MetadataRoute } from "next";
import pool from "@/lib/db";

async function getWatchSitemapCount(): Promise<number> {
  const MAX_PER_SITEMAP = 45000;
  try {
    const { rows } = await pool.query("SELECT COUNT(*) as total FROM videos");
    const total = parseInt(rows[0].total, 10);
    return Math.ceil(total / MAX_PER_SITEMAP);
  } catch {
    // During build, PG may not be available — return safe default
    return 8;
  }
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
      allow: [
        "/",
        "/hentai", "/3d",           // vertical hubs (added 2026-04-12)
        "/watch/", "/tag/", "/character/", "/series/",
        "/trending", "/new", "/tags", "/explore",
        "/blog/", "/glossary/",
      ],
      disallow: ["/api/", "/_next/", "/feed", "/v/", "/favorites", "/history", "/settings"],
    },
    sitemap: sitemaps,
  };
}
