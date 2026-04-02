import type { Metadata } from "next";
import { AgeGate } from "@/components/AgeGate";
import { HomePageClient } from "@/components/HomePageClient";
import { searchPosts } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description:
    "Stream 65,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
};

export default async function HomePage() {
  // Prefetch both tabs server-side
  const [trending, newest] = await Promise.all([
    searchPosts({ limit: 20, order: "score" }),
    searchPosts({ limit: 20, order: "date" }),
  ]);

  const mapVideos = (data: typeof trending.data) =>
    data.map((v) => ({
      id: v.id,
      slug: v.slug,
      url: v.url,
      thumbnail: v.thumbnail,
      score: v.score,
      tags: v.tags,
      characters: v.characters,
      copyrights: v.copyrights,
      artists: v.artists,
      duration: v.duration,
    }));

  return (
    <AgeGate>
      <HomePageClient
        trendingVideos={mapVideos(trending.data)}
        newestVideos={mapVideos(newest.data)}
      />
    </AgeGate>
  );
}
