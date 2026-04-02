import type { MetadataRoute } from "next";

const SITE = "https://iku.gg";

// Generate sitemap at RUNTIME, not build time — avoids Danbooru API hammering during build
export const dynamic = "force-dynamic";
export const revalidate = 86400; // regenerate once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Instead of fetching all 65K videos from Danbooru at build time,
  // just return the top 1000 video URLs using known ID ranges
  const entries: MetadataRoute.Sitemap = [];

  try {
    const { searchPosts } = await import("@/lib/danbooru");

    // Fetch just 2 pages (400 videos) — enough for initial sitemap
    for (let page = 1; page <= 2; page++) {
      const { data: videos } = await searchPosts({
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
    }
  } catch {
    // If API fails during build, return empty — sitemap will populate at runtime
  }

  return entries;
}
