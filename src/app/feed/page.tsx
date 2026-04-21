import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AgeGate } from "@/components/AgeGate";
import { SwipeFeed } from "@/components/SwipeFeed";
import { isLikelyBot } from "@/lib/is-bot";
import { getVideos } from "@/lib/content";
import { buildTitle } from "@/lib/video-display";

export const metadata: Metadata = {
  title: "Hentai Shorts Feed — Swipe & Watch | iku.gg",
  description:
    "Endless vertical hentai shorts. Swipe through 360,000+ free animated clips — TikTok-style feed on iku.gg.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://iku.gg/feed" },
};

export default async function FeedPage() {
  const bot = await isLikelyBot();

  // Bot view: server-rendered list so Googlebot sees real content.
  // The human-facing swipe feed is fully client-rendered (SwipeFeed) which
  // yields an empty shell to crawlers — killing any chance of indexing the
  // 360K-shorts surface. This fallback mirrors the format of a trending
  // feed: headings, links, thumbnails, and enough copy to establish topical
  // relevance for "hentai shorts" / "hentai feed" / "animated shorts".
  if (bot) {
    const { data: videos } = await getVideos({
      limit: 40,
      order: "score",
      requireThumbnail: true,
    });

    return (
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px" }}>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
            Hentai Shorts Feed
          </h1>
          <p style={{ color: "#aaa", maxWidth: 720, lineHeight: 1.6 }}>
            Swipe through a curated stream of animated hentai shorts, updated
            daily. Every clip is vertical-first and optimized for mobile — no
            signup, no paywall on the preview feed. Browse by score, tag, or
            character, and tap through to the full video page for related
            episodes, tags, and artist credits.
          </p>
        </header>

        <section aria-label="Top shorts right now">
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Top shorts right now
          </h2>
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
              listStyle: "none",
              padding: 0,
            }}
          >
            {videos.map((v) => {
              // buildTitle is the same helper PosterCard/watch-page use —
              // prefers clean Latin scraped titles, then character+series,
              // then distinct meaningful tags, finally "Animated Hentai".
              // Avoids the tag-salad fallback ("6+boys 6boys Adventurer
              // Hentai #855275") the hand-rolled version produced.
              const label = buildTitle(v);
              return (
                <li key={v.id}>
                  <Link
                    href={`/watch/${v.slug}`}
                    style={{ display: "block", color: "inherit" }}
                  >
                    {v.thumbnail && (
                      <img
                        src={v.thumbnail}
                        alt={label}
                        loading="lazy"
                        width={220}
                        height={124}
                        style={{
                          width: "100%",
                          aspectRatio: "16 / 9",
                          objectFit: "cover",
                          borderRadius: 8,
                          background: "#111",
                        }}
                      />
                    )}
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        marginTop: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      {label}
                    </h3>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <footer style={{ marginTop: 40, color: "#777", fontSize: 14 }}>
          <p>
            Want more? Browse the full catalogue on{" "}
            <Link href="/explore" style={{ color: "#fff" }}>
              /explore
            </Link>
            , jump to{" "}
            <Link href="/trending" style={{ color: "#fff" }}>
              trending
            </Link>
            , or open a tag like{" "}
            <Link href="/tag/animated" style={{ color: "#fff" }}>
              animated
            </Link>{" "}
            or{" "}
            <Link href="/tag/hentai" style={{ color: "#fff" }}>
              hentai
            </Link>
            .
          </p>
        </footer>
      </main>
    );
  }

  return (
    <AgeGate>
      <SwipeFeed />
    </AgeGate>
  );
}
