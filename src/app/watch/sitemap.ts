import type { MetadataRoute } from "next";
import { searchPosts } from "@/lib/danbooru";

const SITE = "https://iku.gg";

export async function generateSitemaps() {
  // 65K videos / ~200 per page = ~325 pages. Split into 2 sitemap chunks.
  return [{ id: 0 }, { id: 1 }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = parseInt(await props.id, 10);
  const entries: MetadataRoute.Sitemap = [];

  // Each chunk fetches 150 pages of 200 posts = 30K per chunk
  const startPage = id * 150 + 1;
  const endPage = startPage + 149;

  for (let page = startPage; page <= endPage; page++) {
    try {
      const { data: videos, hasMore } = await searchPosts({
        page,
        limit: 200,
        order: "score",
      });

      for (const video of videos) {
        entries.push({
          url: `${SITE}/watch/${video.slug}`,
          lastModified: video.createdAt,
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }

      if (!hasMore) break;
    } catch {
      break;
    }
  }

  return entries;
}
