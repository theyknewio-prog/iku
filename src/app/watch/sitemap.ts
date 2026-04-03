import type { MetadataRoute } from "next";
import danbooruData from "@/data/videos.json";
import gelbooruData from "@/data/gelbooru-videos.json";
import rule34Data from "@/data/rule34-videos.json";

const SITE = "https://iku.gg";

// Static sitemap from scraped data — no API calls needed
export default function sitemap(): MetadataRoute.Sitemap {
  const danbooru = (danbooruData as Array<{ slug: string; createdAt: string }>).map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const gelbooru = (gelbooruData as Array<{ slug: string; createdAt: string }>).map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.createdAt || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const rule34 = (rule34Data as Array<{ slug: string; createdAt: string }>).map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.createdAt || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...danbooru, ...gelbooru, ...rule34];
}
