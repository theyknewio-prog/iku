import type { MetadataRoute } from "next";
import { getPopularTags, getPopularCharacters } from "@/lib/danbooru";

const SITE = "https://iku.gg";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tags, characters] = await Promise.all([
    getPopularTags(200),
    getPopularCharacters(200),
  ]);

  const allSlugs = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  for (const tag of tags) {
    if (allSlugs.has(tag.name)) continue;
    allSlugs.add(tag.name);
    entries.push({
      url: `${SITE}/tag/${encodeURIComponent(tag.name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const char of characters) {
    if (allSlugs.has(char.name)) continue;
    allSlugs.add(char.name);
    entries.push({
      url: `${SITE}/tag/${encodeURIComponent(char.name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  return entries;
}
