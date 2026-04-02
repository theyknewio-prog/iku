"use client";

import { useState } from "react";
import { HomeFeed } from "./HomeFeed";

interface FeedVideo {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  tags: string[];
  characters: string[];
  copyrights: string[];
  artists: string[];
  duration: number | null;
}

export function HomePageClient({
  trendingVideos,
  newestVideos,
}: {
  trendingVideos: FeedVideo[];
  newestVideos: FeedVideo[];
}) {
  const [tab, setTab] = useState<"trending" | "newest">("trending");

  return (
    <main className="shell-content">
      {/* Tabs — client-side, no page reload */}
      <div className="content-tabs-bar">
        <div className="content-tabs">
          <button
            className={`content-tab${tab === "trending" ? " content-tab--active" : ""}`}
            onClick={() => setTab("trending")}
          >
            Trending
          </button>
          <button
            className={`content-tab${tab === "newest" ? " content-tab--active" : ""}`}
            onClick={() => setTab("newest")}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Feed — switches instantly, no reload */}
      {tab === "trending" ? (
        <HomeFeed key="trending" initialVideos={trendingVideos} mode="trending" />
      ) : (
        <HomeFeed key="newest" initialVideos={newestVideos} mode="newest" />
      )}
    </main>
  );
}
