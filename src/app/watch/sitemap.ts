import type { MetadataRoute } from "next";
import danbooruData from "@/data/videos.json";
import gelbooruData from "@/data/gelbooru-videos.json";
import rule34Data from "@/data/rule34-videos.json";
import rule34videoData from "@/data/rule34video-videos.json";
// WP hentai data loaded conditionally (may not exist yet during first build)
let wpHentaiData: Array<{ slug: string; date: string }> = [];
try { wpHentaiData = require("@/data/wp-hentai-videos.json"); } catch {}

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

  const rule34video = (rule34videoData as Array<{ slug: string; date: string }>).map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.date || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const wpHentai = wpHentaiData.map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.date || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...danbooru, ...gelbooru, ...rule34, ...rule34video, ...wpHentai];
}
