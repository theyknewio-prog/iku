import type { MetadataRoute } from "next";

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;

type Entry = { slug: string; date: string };

function loadAllEntries(): Entry[] {
  const entries: Entry[] = [];

  const danbooru = require("@/data/videos.json") as Array<{ slug: string; createdAt: string }>;
  for (const v of danbooru) entries.push({ slug: v.slug, date: v.createdAt || "" });

  const gelbooru = require("@/data/gelbooru-videos.json") as Array<{ slug: string; createdAt: string }>;
  for (const v of gelbooru) entries.push({ slug: v.slug, date: v.createdAt || "" });

  const rule34 = require("@/data/rule34-videos.json") as Array<{ slug: string; createdAt: string }>;
  for (const v of rule34) entries.push({ slug: v.slug, date: v.createdAt || "" });

  const rule34video = require("@/data/rule34video-videos.json") as Array<{ slug: string; date: string }>;
  for (const v of rule34video) entries.push({ slug: v.slug, date: v.date || "" });

  try {
    const wp = require("@/data/wp-hentai-videos.json") as Array<{ slug: string; date: string }>;
    for (const v of wp) entries.push({ slug: v.slug, date: v.date || "" });
  } catch {}

  return entries;
}

export async function generateSitemaps() {
  const total = loadAllEntries().length;
  const count = Math.ceil(total / MAX_PER_SITEMAP);
  return Array.from({ length: count }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const all = loadAllEntries();
  const start = id * MAX_PER_SITEMAP;
  const chunk = all.slice(start, start + MAX_PER_SITEMAP);

  return chunk.map((v) => ({
    url: `${SITE}/watch/${v.slug}`,
    lastModified: v.date || new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
