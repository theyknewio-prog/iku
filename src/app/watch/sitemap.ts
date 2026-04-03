import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;
const DATA_DIR = path.join(process.cwd(), "src/data");

type Entry = { slug: string; date: string };

function loadAllEntries(): Entry[] {
  const entries: Entry[] = [];

  const readJSON = (file: string) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    } catch { return []; }
  };

  for (const v of readJSON("videos.json") as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of readJSON("gelbooru-videos.json") as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of readJSON("rule34-videos.json") as Array<{ slug: string; createdAt: string }>) {
    entries.push({ slug: v.slug, date: v.createdAt || "" });
  }
  for (const v of readJSON("rule34video-videos.json") as Array<{ slug: string; date: string }>) {
    entries.push({ slug: v.slug, date: v.date || "" });
  }
  for (const v of readJSON("wp-hentai-videos.json") as Array<{ slug: string; date: string }>) {
    entries.push({ slug: v.slug, date: v.date || "" });
  }

  return entries;
}

export async function generateSitemaps() {
  const total = loadAllEntries().length;
  const count = Math.ceil(total / MAX_PER_SITEMAP);
  return Array.from({ length: count }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = parseInt(idStr, 10);
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
