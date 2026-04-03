import type { MetadataRoute } from "next";
import danbooruData from "@/data/videos.json";
import gelbooruData from "@/data/gelbooru-videos.json";
import rule34Data from "@/data/rule34-videos.json";
import rule34videoData from "@/data/rule34video-videos.json";

let wpHentaiData: Array<{ slug: string; date: string }> = [];
try { wpHentaiData = require("@/data/wp-hentai-videos.json"); } catch {}

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000; // Google limit is 50K, stay under

type SitemapEntry = { slug: string; date: string };

function buildAllEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const v of danbooruData as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of gelbooruData as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of rule34Data as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of rule34videoData as Array<{ slug: string; date: string }>) {
    entries.push({ slug: v.slug, date: v.date || "" });
  }
  for (const v of wpHentaiData) {
    entries.push({ slug: v.slug, date: v.date || "" });
  }

  return entries;
}

const allEntries = buildAllEntries();
const totalSitemaps = Math.ceil(allEntries.length / MAX_PER_SITEMAP);

/** Tell Next.js how many sitemap files to generate */
export async function generateSitemaps() {
  return Array.from({ length: totalSitemaps }, (_, i) => ({ id: i }));
}

/** Generate one sitemap chunk */
export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  const start = id * MAX_PER_SITEMAP;
  const chunk = allEntries.slice(start, start + MAX_PER_SITEMAP);

  return chunk.map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.date || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
