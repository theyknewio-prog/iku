import type { Metadata } from "next";
import { AgeGate } from "@/components/AgeGate";
import { HomeFeed } from "@/components/HomeFeed";
import { searchPosts } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description:
    "Stream 65,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
};

export default async function HomePage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "newest" ? "newest" : "trending";

  const { data: videos } = await searchPosts({
    limit: 20,
    order: tab === "trending" ? "score" : "date",
  });

  const feedVideos = videos.map((v) => ({
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
      <main className="shell-content">
        {/* Tabs */}
        <div className="content-tabs-bar">
          <div className="content-tabs">
            <a
              href="/"
              className={`content-tab${tab === "trending" ? " content-tab--active" : ""}`}
            >
              Trending
            </a>
            <a
              href="/?tab=newest"
              className={`content-tab${tab === "newest" ? " content-tab--active" : ""}`}
            >
              Newest
            </a>
          </div>
        </div>

        {/* RedGIFs-style player feed */}
        <HomeFeed initialVideos={feedVideos} mode={tab} />
      </main>
    </AgeGate>
  );
}
