import type { MetadataRoute } from "next";
import videosData from "@/data/videos.json";

const SITE = "https://iku.gg";

// Static sitemap from scraped data — no API calls needed
export default function sitemap(): MetadataRoute.Sitemap {
  const videos = videosData as Array<{ slug: string; createdAt: string }>;

  return videos.map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
}
