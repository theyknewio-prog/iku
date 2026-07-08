import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AgeGate } from "@/components/AgeGate";
import { isLikelyBot } from "@/lib/is-bot";
import { PosterCard } from "@/components/PosterCard";
import { Carousel } from "@/components/Carousel";
import { getPopularCharacters } from "@/lib/danbooru";
import {
  getVideos,
  getCuratedGenreCounts,
  getVideoOfTheDay,
  getThumbnailsForTags,
} from "@/lib/content";
import { getRule34Post } from "@/lib/rule34";
import { buildTitle, pickGenreTag } from "@/lib/video-display";
import { SERIES } from "@/data/series";
import { OnlineCounter } from "@/components/OnlineCounter";
import { JoinDiscordCTA } from "@/components/JoinDiscordCTA";
import { SignupCTA } from "@/components/SignupCTA";
import { ScrollReveal } from "@/components/ScrollReveal";
import { MagneticButton } from "@/components/MagneticButton";
import { AdJoiBanner, AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { NativeOfferCard } from "@/components/NativeOfferCard";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai, 3D Hentai & Cartoon Porn | 300,000+ Videos",
  description:
    "Stream 300,000+ free hentai, 3D hentai & cartoon porn animations. Genshin, Overwatch, Blue Archive, SFM & classic 2D anime. Swipe Shorts feed included. No signup.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg" },
  openGraph: {
    title: "iku.gg — Free Hentai, 3D Cartoon Porn & Animation Tube",
    description:
      "300,000+ free videos: 3D hentai, SFM, cartoon porn, 2D anime, Shorts feed. Genshin, Overwatch, Blue Archive & more.",
    siteName: "iku.gg",
    type: "website",
    url: "https://iku.gg",
    images: [
      {
        url: "https://iku.gg/og-default.png",
        width: 1200,
        height: 630,
        alt: "iku.gg — Free Hentai, 3D & Cartoon Porn",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iku.gg — Free Hentai, 3D & Cartoon Porn",
    description:
      "300,000+ free videos: 3D hentai, SFM, cartoon porn, 2D anime, Shorts feed. Genshin, Overwatch & more.",
    images: ["https://iku.gg/og-default.png"],
  },
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

/* ── Genre tag color classes — round-robin ─────────────── */
const TAG_COLORS = [
  "hp-gt-pink",
  "hp-gt-purple",
  "hp-gt-cyan",
  "hp-gt-gold",
  "hp-gt-green",
  "hp-gt-red",
  "hp-gt-orange",
  "hp-gt-blue",
];

/* ── Character fallback emojis (when no thumbnail) ───────── */
const CHAR_EMOJIS = [
  "⚔️",
  "🌸",
  "🧙",
  "🐉",
  "🏹",
  "😈",
  "👹",
  "🌙",
  "🤖",
  "🌿",
  "⚗️",
  "🐱",
];

/* ── Character gradient ring classes — round-robin ─────── */
const CHAR_RING_CLASSES = [
  "hp-grad-pink",
  "hp-grad-cyan",
  "hp-grad-purple",
  "hp-grad-gold",
  "hp-grad-green",
  "hp-grad-red",
  "hp-grad-rainbow",
];

/* ── Grid card category color classes ──────────────────── */
const GRID_CATEGORY_COLORS = [
  "hp-gt-purple",
  "hp-gt-gold",
  "hp-gt-cyan",
  "hp-gt-green",
  "hp-gt-red",
  "hp-gt-pink",
  "hp-gt-orange",
  "hp-gt-blue",
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreToRating(score: number): number {
  // Map score to 1-5 rating scale
  if (score >= 500) return 5;
  if (score >= 200) return 4.8;
  if (score >= 100) return 4.5;
  if (score >= 50) return 4.2;
  if (score >= 20) return 4.0;
  return 3.8;
}

function formatViews(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(0)}K`;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
  return String(score);
}

export default async function HomePage() {
  const bot = await isLikelyBot();

  // Random offset (pages 1–5) so "New Releases" shows different content on each load.
  const newReleasesPage = Math.floor(Math.random() * 5) + 1;

  // Parallelize every top-level data fetch. Previously these were sequential
  // `await`s which made TTFB ~1.1s (cold path) because Node waited on each
  // query before even starting the next. All of these are independent → one
  // Promise.all drops the wall clock from sum(latencies) to max(latency).
  // getThumbnailsForTags is the only one that has a data dependency on the
  // result of getCuratedGenreCounts, so it stays in a second step but is
  // cheap anyway (memoized 1h TTL, per-tag lookup).
  const [
    trending,
    newest,
    topRated,
    genres,
    characters,
    vod,
    hentaiCover,
    threeDCover,
  ] = await Promise.all([
    getVideos({
      limit: 20,
      order: "score",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 10,
      page: newReleasesPage,
      order: "date",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      // Bumped 8 → 24 so the "native every 6 cards" cadence (line ~647)
      // actually yields 3 ad slots on this grid instead of 1. At limit 8 the
      // mod-6 condition only fired once (i=5) leaving the grid under-
      // monetized. 24 rows = positions 6, 12, 18 → 3 natives.
      limit: 24,
      order: "favcount",
      source: "all",
      requireThumbnail: true,
    }),
    getCuratedGenreCounts(),
    getPopularCharacters(12),
    getVideoOfTheDay(),
    // Cover thumbs for the 3 vertical hub tiles.
    getVideos({
      limit: 1,
      order: "score",
      vertical: "hentai",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 1,
      order: "score",
      vertical: "3d",
      requireThumbnail: true,
    }),
  ]);
  const hentaiTileBg = hentaiCover.data[0]?.thumbnail || "";
  const threeDTileBg = threeDCover.data[0]?.thumbnail || "";
  const shortsTileBg = trending.data[0]?.thumbnail || "";

  // Pinned video — surfaced as the first card in "Trending Now" only
  // (hero is picked before this so it keeps the organic top-scored video).
  const pinned = await getRule34Post(5042016).catch(() => null);

  // Cover thumbnail per genre (memoized 1h, near-zero cost on warm cache).
  const genreThumbs = await getThumbnailsForTags(genres.map((g) => g.name));

  const hero = trending.data[0];

  if (pinned) {
    trending.data = [
      pinned,
      ...trending.data.filter((v) => v.slug !== pinned.slug),
    ];
  }

  const Wrapper = bot ? React.Fragment : AgeGate;

  return (
    <Wrapper>
      <main className="v2-page">
        <div className="v2-content">
          {/* ── Mobile stats bar — visible only when hero-right is hidden (<960px) ── */}
          <div className="hp-hero-mobile-stats" aria-label="Live stats">
            <div className="hp-hero-mobile-stats__item hp-hero-mobile-stats__item--live">
              <OnlineCounter />
            </div>
            <div className="hp-hero-mobile-stats__item">
              <span className="hp-hero-mobile-stats__rating">
                &#9733; 4.8 rating
              </span>
            </div>
            <div className="hp-hero-mobile-stats__item">
              <span className="hp-hero-mobile-stats__new">+847 today</span>
            </div>
          </div>

          {/* ================================================================
              HERO -- Split layout (left text + right gradient orbs)
          ================================================================ */}
          <section className="hp-hero" aria-label="Featured content">
            <div className="hp-hero-left">
              <div className="hp-hero-eyebrow">
                <span className="hp-hero-eyebrow__dot" />
                Hentai · 3D · Cartoon Porn · Shorts
              </div>

              <h1 className="hp-hero-title">
                Free <span className="hp-hero-gradient-text">Hentai</span>
                <br />
                &amp;{" "}
                <span className="hp-hero-gradient-text">3D Cartoon Porn</span>
                <br />
                All In One Tube
              </h1>
              <p className="hp-hero-sub">
                <strong>300,000+</strong> videos — 2D hentai episodes, 3D SFM
                animations, Genshin &amp; Overwatch compilations, HMV, plus a
                TikTok-style Shorts feed. No signup.
              </p>

              <div className="hp-hero-ctas">
                <MagneticButton>
                  <Link href="/hentai" className="hp-btn-primary">
                    <span>🌸</span> Watch Hentai
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link href="/3d" className="hp-btn-secondary">
                    <span>🎮</span> Browse 3D
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link href="/feed" className="hp-btn-secondary">
                    <span>⚡</span> Shorts Feed
                  </Link>
                </MagneticButton>
              </div>

              <div style={{ marginTop: "20px" }}>
                <JoinDiscordCTA variant="hero" />
              </div>

              <div className="hp-hero-stats">
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">300K+</span>
                  <span className="hp-hero-stat__label">Videos</span>
                </div>
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">12K+</span>
                  <span className="hp-hero-stat__label">Characters</span>
                </div>
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">Free</span>
                  <span className="hp-hero-stat__label">Always</span>
                </div>
              </div>
            </div>

            <div className="hp-hero-right">
              <div className="hp-hero-illustration">
                {/* Animated orbs */}
                <div className="hp-hero-orb hp-hero-orb--1" />
                <div className="hp-hero-orb hp-hero-orb--2" />
                <div className="hp-hero-orb hp-hero-orb--3" />

                {/* Floating badges */}
                <div className="hp-hero-badge-float hp-hero-badge-float--1">
                  <OnlineCounter />
                </div>
                <div className="hp-hero-badge-float hp-hero-badge-float--2">
                  4.8 avg rating
                </div>
                <div className="hp-hero-badge-float hp-hero-badge-float--3">
                  +847 today
                </div>

                {/* Preview card */}
                {hero && (
                  <Link
                    href={`/watch/${hero.slug}`}
                    className="hp-hero-play-card"
                  >
                    <div className="hp-hero-play-card__thumb">
                      {hero.preview ? (
                        <Image
                          src={hero.preview}
                          alt="Trending now"
                          fill
                          sizes="(min-width:1600px) 780px, (min-width:1280px) 680px, 420px"
                          style={{ objectFit: "cover" }}
                          unoptimized
                        />
                      ) : (
                        <span style={{ fontSize: 36 }}>&#9654;</span>
                      )}
                    </div>
                    <div className="hp-hero-play-card__title">
                      Trending right now
                    </div>
                    <div className="hp-hero-play-card__meta">
                      <span className="hp-hero-play-card__stars">
                        &#9733;&#9733;&#9733;&#9733;&#9733;
                      </span>
                      <span>{formatViews(hero.score)} views</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              UNLOCK BANNER — V6 pattern (OnlyFans-style subscription
              hook). Most profitable per-pixel card on the homepage.
              ════════════════════════════════════════════════════════ */}
          <Link
            href="/pricing"
            className="hp-unlock-banner"
            aria-label="Unlock all creator libraries with iku Premium"
          >
            <span className="hp-unlock-banner__icon" aria-hidden="true">
              ✨
            </span>
            <span className="hp-unlock-banner__text">
              <span className="hp-unlock-banner__title">
                Unlock every full-length episode
              </span>
              <span className="hp-unlock-banner__sub">
                38,000+ episodes. Skip every ad. 4K when available. Cancel
                anytime.
              </span>
            </span>
            <span className="hp-unlock-banner__cta">4.99€/mo</span>
          </Link>

          {/* ════════════════════════════════════════════════════════
              VERTICAL HUBS — three CTA tiles linking to the 2D hentai,
              3D/SFM, and Shorts verticals. Shown directly below the hero
              so first-time visitors grasp the catalogue layout in one
              glance.
              ════════════════════════════════════════════════════════ */}
          <section className="hp-verticals" aria-label="Browse by format">
            <Link
              href="/hentai"
              className="hp-vertical-tile hp-vertical-tile--hentai"
              style={
                hentaiTileBg
                  ? { backgroundImage: `url("${hentaiTileBg}")` }
                  : undefined
              }
            >
              <span className="hp-vertical-tile__emoji" aria-hidden="true">
                🌸
              </span>
              <span className="hp-vertical-tile__title">Hentai</span>
              <span className="hp-vertical-tile__sub">
                Full 2D anime episodes
              </span>
              <span className="hp-vertical-tile__count">7k+ OAV</span>
            </Link>
            <Link
              href="/3d"
              className="hp-vertical-tile hp-vertical-tile--3d"
              style={
                threeDTileBg
                  ? { backgroundImage: `url("${threeDTileBg}")` }
                  : undefined
              }
            >
              <span className="hp-vertical-tile__emoji" aria-hidden="true">
                🎮
              </span>
              <span className="hp-vertical-tile__title">3D Hentai</span>
              <span className="hp-vertical-tile__sub">
                SFM, games, cartoon porn
              </span>
              <span className="hp-vertical-tile__count">300k+ clips</span>
            </Link>
            <Link
              href="/feed"
              className="hp-vertical-tile hp-vertical-tile--shorts"
              style={
                shortsTileBg
                  ? { backgroundImage: `url("${shortsTileBg}")` }
                  : undefined
              }
            >
              <span className="hp-vertical-tile__emoji" aria-hidden="true">
                ⚡
              </span>
              <span className="hp-vertical-tile__title">Shorts</span>
              <span className="hp-vertical-tile__sub">Swipe infinite feed</span>
              <span className="hp-vertical-tile__count">Mixed</span>
            </Link>
          </section>

          {/* Placement A — CR Joi-AI 300x250 GIF (homepage-a pool: 2
              GIFs, no overlap with /watch surfaces). Native, zero chrome. */}
          <div style={{ margin: "24px auto" }}>
            <AdJoiBanner />
          </div>

          {/* ================================================================
              TRENDING NOW -- Horizontal poster scroll
          ================================================================ */}
          <Carousel title="🔥 Trending Now" badge="HOT" seeAllHref="/trending">
            {trending.data.flatMap((video, i) => {
              const card = (
                <PosterCard
                  key={video.id}
                  video={video}
                  rank={i < 8 ? i + 1 : undefined}
                  priority={i < 5}
                />
              );
              // Ad-break après le 3e poster (recon 2026-07-08: mobile
              // n'affiche que ~1.8 posters, la position 9 n'était JAMAIS
              // atteinte — naturalWidth 0 prouvé). Même flex item, créa
              // 300x250 native.
              if (i === 2) {
                return [
                  card,
                  <div
                    key="ad-trending-grid"
                    style={{
                      flex: "0 0 300px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <AdRotationBanner
                      slug="joi-ai"
                      surface="trending-grid"
                      eager
                    />
                  </div>,
                ];
              }
              return card;
            })}
          </Carousel>

          {/* Premium CTA #1 — slim inline strip after Trending. */}
          <Link
            href="/pricing"
            className="hp-premium-strip"
            aria-label="Get iku Premium"
          >
            <span className="hp-premium-strip__icon">🚫</span>
            <span className="hp-premium-strip__text">
              <strong>Skip every ad</strong> · 4K when available · Early access
              · Unlimited favorites
            </span>
            <span className="hp-premium-strip__cta">Premium 4.99€/mo →</span>
          </Link>

          {/* ================================================================
              VIDEO OF THE DAY — deterministic daily pick
          ================================================================ */}
          {vod && (
            <section aria-label="Video of the Day" className="hp-vod">
              <div className="hp-vod__badge">
                ✨ Video of the Day ·{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <Link href={`/watch/${vod.slug}`} className="hp-vod__card">
                <div className="hp-vod__thumb">
                  {vod.thumbnail && (
                    <Image
                      src={vod.thumbnail}
                      alt={vod.title || vod.characters[0] || "Video of the Day"}
                      fill
                      sizes="(max-width: 960px) 100vw, 600px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                      priority
                    />
                  )}
                  <div className="hp-vod__overlay" />
                  <div className="hp-vod__play">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>
                </div>
                <div className="hp-vod__info">
                  <div className="hp-vod__eyebrow">
                    🎯 Today's hand-picked banger
                  </div>
                  <h2 className="hp-vod__title">
                    {vod.title
                      ? vod.title.replace(/_/g, " ")
                      : vod.characters[0]?.replace(/_/g, " ") ||
                        "Featured clip"}
                  </h2>
                  {vod.characters[0] && (
                    <div className="hp-vod__char">
                      👤 {vod.characters[0].replace(/_/g, " ")}
                    </div>
                  )}
                  <p className="hp-vod__desc">
                    Curated pick of the day. Watch before midnight UTC to earn{" "}
                    <strong>+20 bonus points</strong>. A new pick drops every
                    day at 00:00 UTC.
                  </p>
                  <div className="hp-vod__cta">Watch now →</div>
                </div>
              </Link>
            </section>
          )}

          {/* Placement B — HilltopAds 300x250 banner (zone 6969681). CPM
              passive. srcdoc iframe at native size, zero chrome. */}
          <div style={{ margin: "24px auto" }}>
            <HilltopAdsBanner />
          </div>

          {/* ================================================================
              TOP RATED THIS WEEK -- 4-column grid
          ================================================================ */}
          <section aria-label="Top Rated This Week">
            <div className="hp-section-header">
              <h2 className="hp-section-title">⭐ Top Rated This Week</h2>
              <Link href="/explore" className="hp-section-link">
                See all &#8594;
              </Link>
            </div>

            <div className="hp-video-grid" role="list">
              {topRated.data.map((video, i) => {
                const charName = video.characters[0]
                  ? video.characters[0].replace(/_/g, " ")
                  : null;
                const categoryColor =
                  GRID_CATEGORY_COLORS[i % GRID_CATEGORY_COLORS.length];
                const genre = pickGenreTag(video);
                const title = buildTitle(video);
                const rating = scoreToRating(video.score);
                const isHot = video.score >= 200;
                const isNew =
                  Date.now() - new Date(video.createdAt).getTime() <
                  72 * 60 * 60 * 1000;

                return (
                  <React.Fragment key={video.id}>
                    <Link
                      href={`/watch/${video.slug}`}
                      className="hp-grid-card"
                      role="listitem"
                    >
                      <div className="hp-grid-card__thumb">
                        <div className="hp-grid-card__thumb-inner">
                          {video.preview ? (
                            <Image
                              src={video.preview}
                              alt={title}
                              fill
                              sizes="(max-width: 600px) 50vw, (max-width: 960px) 33vw, 25vw"
                              style={{ objectFit: "cover" }}
                              unoptimized
                            />
                          ) : (
                            <div
                              className={`hp-thumb-grad hp-thumb-grad--${(i % 12) + 1}`}
                            />
                          )}
                        </div>
                        {isHot && <span className="hp-hot-badge">🔥 Hot</span>}
                        {!isHot && isNew && (
                          <span className="hp-new-badge">New</span>
                        )}
                        {video.duration && (
                          <span className="hp-duration-badge">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                      <div className="hp-grid-card__info">
                        <span
                          className={`hp-grid-card__category ${categoryColor}`}
                        >
                          {genre}
                        </span>
                        <div className="hp-grid-card__title">{title}</div>
                        {charName && (
                          <div className="hp-grid-card__char">
                            👤 {charName}
                          </div>
                        )}
                        <div className="hp-grid-card__foot">
                          <div className="hp-rating-row">
                            <span className="hp-star-filled">&#9733;</span>
                            <span className="hp-rating-num">
                              {rating.toFixed(1)}
                            </span>
                            <span>({formatViews(video.favorites)})</span>
                          </div>
                          <span className="hp-views-count">
                            {formatViews(video.score)} views
                          </span>
                        </div>
                      </div>
                    </Link>
                    {/* Natives in-grid 1/6 — comblent ~4 écrans de scroll
                        sans pub mesurés au recon (candy d'abord: joi est
                        déjà en Placement A au-dessus). */}
                    {(i === 5 || i === 11 || i === 17) && (
                      <NativeOfferCard
                        slug={
                          i === 5 ? "candy-ai" : i === 11 ? "swipey" : "meet"
                        }
                        surface={`toprated-native-${i}`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          {/* Placement A2 — CR Candy.AI 300x250 GIF (homepage-a2 pool:
              3 Cartoon-Hentai GIFs, no overlap with /watch surfaces).
              Native, zero chrome. Brand-matched for hentai audience. */}
          <div style={{ margin: "24px auto" }}>
            <AdRotationBanner slug="candy-ai" surface="homepage-a2" />
          </div>

          {/* ================================================================
              POPULAR GAMES — 3D niche anchor. Ten gradient tiles linking
              to /series/[franchise] (virtual fallback covers the
              franchises not in SERIES static data).
          ================================================================ */}
          <section
            aria-label="Popular Games &amp; Franchises"
            className="hp-games"
          >
            <div className="hp-section-header">
              <h2 className="hp-section-title">🎮 Popular Games</h2>
              <Link href="/series" className="hp-section-link">
                See all &#8594;
              </Link>
            </div>

            <div className="hp-games-grid">
              {[
                {
                  slug: "genshin_impact",
                  label: "Genshin Impact",
                  count: "3.4k",
                  grad: "linear-gradient(135deg, #11998e 0%, #4776e6 100%)",
                },
                {
                  slug: "blue_archive",
                  label: "Blue Archive",
                  count: "2.2k",
                  grad: "linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)",
                },
                {
                  slug: "overwatch",
                  label: "Overwatch",
                  count: "2.2k",
                  grad: "linear-gradient(135deg, #ff6b35 0%, #e8467c 100%)",
                },
                {
                  slug: "zenless_zone_zero",
                  label: "Zenless Zone Zero",
                  count: "1.3k",
                  grad: "linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)",
                },
                {
                  slug: "final_fantasy",
                  label: "Final Fantasy",
                  count: "1.2k",
                  grad: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
                },
                {
                  slug: "honkai:_star_rail",
                  label: "Honkai Star Rail",
                  count: "848",
                  grad: "linear-gradient(135deg, #7b2ff7 0%, #4776e6 100%)",
                },
                {
                  slug: "fortnite",
                  label: "Fortnite",
                  count: "772",
                  grad: "linear-gradient(135deg, #e8467c 0%, #7b2ff7 100%)",
                },
                {
                  slug: "resident_evil",
                  label: "Resident Evil",
                  count: "706",
                  grad: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
                },
                {
                  slug: "nier:automata",
                  label: "Nier Automata",
                  count: "613",
                  grad: "linear-gradient(135deg, #c94b4b 0%, #2c5364 100%)",
                },
                {
                  slug: "dead_or_alive",
                  label: "Dead or Alive",
                  count: "705",
                  grad: "linear-gradient(135deg, #ff6b35 0%, #c94b4b 100%)",
                },
              ].map((g) => (
                <Link
                  key={g.slug}
                  href={`/series/${encodeURIComponent(g.slug)}`}
                  className="hp-game-tile"
                  style={{ background: g.grad }}
                >
                  <span className="hp-game-tile__label">{g.label}</span>
                  <span className="hp-game-tile__count">{g.count} videos</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Soulkyn vertical 4:5 — déplacé ici (2026-07-08): la section
              Games sépare candy-ai du Soulkyn, plus de mur de 774px. */}
          <div style={{ margin: "16px auto 24px" }}>
            <SoulkynVerticalAd surface="homepage-soulkyn" />
          </div>

          {/* ================================================================
              POPULAR CHARACTERS -- Circular avatars with gradient rings
          ================================================================ */}
          <section aria-label="Popular Characters">
            <div className="hp-section-header">
              <h2 className="hp-section-title">💖 Popular Characters</h2>
              <Link href="/tags" className="hp-section-link">
                See all &#8594;
              </Link>
            </div>

            <div className="hp-chars-scroll" role="list">
              {characters.map((char, i) => {
                const ringClass =
                  CHAR_RING_CLASSES[i % CHAR_RING_CLASSES.length];
                const displayName = char.name.replace(/_/g, " ");
                const count =
                  char.count >= 1000
                    ? `${(char.count / 1000).toFixed(1)}k`
                    : String(char.count);

                return (
                  <Link
                    key={char.name}
                    href={`/character/${encodeURIComponent(char.name)}`}
                    className="hp-char-item"
                    role="listitem"
                  >
                    <div className={`hp-char-avatar-wrap ${ringClass}`}>
                      <div className="hp-char-avatar">
                        <span
                          className="hp-char-avatar__emoji"
                          style={{ fontSize: "28px", lineHeight: 1 }}
                        >
                          {CHAR_EMOJIS[i % CHAR_EMOJIS.length]}
                        </span>
                      </div>
                    </div>
                    <span className="hp-char-name">{displayName}</span>
                    <span className="hp-char-count">{count} clips</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Premium CTA #2 — different angle from #1 (yearly nudge). */}
          <Link
            href="/pricing"
            className="hp-premium-strip hp-premium-strip--yearly"
            aria-label="Save with yearly Premium"
          >
            <span className="hp-premium-strip__icon">💎</span>
            <span className="hp-premium-strip__text">
              <strong>Yearly Premium — save 33%</strong> · 39.99€/year
              (3.33€/mo) · Cancel anytime
            </span>
            <span className="hp-premium-strip__cta">See plans →</span>
          </Link>

          {/* ================================================================
              BROWSE BY GENRE -- Instagram-stories style circle row
              Horizontal scrollable, real cover thumbnails per tag.
          ================================================================ */}
          <section aria-label="Browse by Genre">
            <div className="hp-section-header">
              <h2 className="hp-section-title">🏷️ Browse by Genre</h2>
              <Link href="/tags" className="hp-section-link">
                See all &#8594;
              </Link>
            </div>

            <div className="hp-tag-stories" role="list">
              {genres.map((genre, i) => {
                const thumb = genreThumbs[genre.name] || "";
                const colorClass = TAG_COLORS[i % TAG_COLORS.length];
                const count =
                  genre.count >= 1000
                    ? `${(genre.count / 1000).toFixed(1)}k`
                    : String(genre.count);
                return (
                  <Link
                    key={genre.name}
                    href={`/tag/${encodeURIComponent(genre.name)}`}
                    className="hp-tag-story"
                    role="listitem"
                    aria-label={`${genre.name} — ${count} videos`}
                  >
                    <div className={`hp-tag-story__ring ${colorClass}`}>
                      <div className="hp-tag-story__avatar">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 88px, 104px"
                            className="hp-tag-story__img"
                            unoptimized
                          />
                        ) : (
                          <span className="hp-tag-story__emoji" aria-hidden>
                            {genre.emoji}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="hp-tag-story__name">
                      {genre.name.charAt(0).toUpperCase() + genre.name.slice(1)}
                    </span>
                    <span className="hp-tag-story__count">{count}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ================================================================
              NEW RELEASES -- Horizontal poster scroll
          ================================================================ */}
          <Carousel title="🆕 New Releases" badge="NEW" seeAllHref="/new">
            {newest.data.map((video) => (
              <PosterCard key={video.id} video={video} badge="NEW" />
            ))}
          </Carousel>

          {/* Swipey 300x250 — comble le gap ~2400px avant le footer
              mesuré au recon 2026-07-08. */}
          <div style={{ margin: "24px auto" }}>
            <AdRotationBanner slug="swipey" surface="homepage-b3" />
          </div>

          {/* Signup CTA — anon visitors only, before the Pro pitch */}
          <SignupCTA placement="homepage" />

          {/* ================================================================
              GO PRO CTA — prominent, animated, above the footer
          ================================================================ */}
          <ScrollReveal y={40} duration={1}>
            <section className="hp-go-pro" aria-label="Upgrade to Pro">
              <div className="hp-go-pro__bg" aria-hidden="true">
                <div className="hp-go-pro__orb hp-go-pro__orb--1" />
                <div className="hp-go-pro__orb hp-go-pro__orb--2" />
                <div className="hp-go-pro__orb hp-go-pro__orb--3" />
              </div>
              <div className="hp-go-pro__content">
                <div className="hp-go-pro__eyebrow">✨ iku.gg Pro</div>
                <h2 className="hp-go-pro__title">
                  Support iku.{" "}
                  <span className="hp-go-pro__title-accent">Get more.</span>
                </h2>
                <p className="hp-go-pro__sub">
                  Unlimited favorites, 48h early access on new drops, Discord
                  Pro lounge, priority loading, and more. From{" "}
                  <strong>4.99€/month</strong> — cancel anytime.
                </p>
                <div className="hp-go-pro__features">
                  <span>❤️ Unlimited favorites</span>
                  <span>🎯 Early access 48h</span>
                  <span>💎 Pro badge</span>
                  <span>🎮 Discord Pro channel</span>
                  <span>⚡ Priority loading</span>
                  <span>🔥 4K when available</span>
                </div>
                <div className="hp-go-pro__ctas">
                  <MagneticButton>
                    <Link
                      href="/pricing"
                      className="hp-go-pro__btn hp-go-pro__btn--primary"
                    >
                      See plans ✨
                    </Link>
                  </MagneticButton>
                  <MagneticButton>
                    <Link
                      href="/pricing"
                      className="hp-go-pro__btn hp-go-pro__btn--ghost"
                    >
                      Lifetime 69.99€
                      <span className="hp-go-pro__btn-sub">
                        Limited 500 spots
                      </span>
                    </Link>
                  </MagneticButton>
                </div>
              </div>
            </section>
          </ScrollReveal>
        </div>

        {/* ================================================================
            FOOTER
        ================================================================ */}
        <footer className="hp-footer">
          <div className="hp-footer__grid">
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Browse</h3>
              <Link href="/trending" className="hp-footer__link">
                Trending
              </Link>
              <Link href="/new" className="hp-footer__link">
                New Releases
              </Link>
              <Link href="/explore" className="hp-footer__link">
                Explore All
              </Link>
              <Link href="/tags" className="hp-footer__link">
                All Tags
              </Link>
              <Link href="/feed" className="hp-footer__link">
                Video Feed
              </Link>
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Characters</h3>
              {characters.slice(0, 6).map((c) => (
                <Link
                  key={c.name}
                  href={`/character/${encodeURIComponent(c.name)}`}
                  className="hp-footer__link"
                >
                  {c.name.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Series</h3>
              {SERIES.slice(0, 6).map((s) => (
                <Link
                  key={s.slug}
                  href={`/series/${s.slug}`}
                  className="hp-footer__link"
                >
                  {s.name}
                </Link>
              ))}
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">About</h3>
              <Link href="/blog" className="hp-footer__link">
                Blog
              </Link>
              <Link href="/glossary" className="hp-footer__link">
                Glossary
              </Link>
              <a href="/terms" className="hp-footer__link">
                Terms
              </a>
              <a href="/privacy" className="hp-footer__link">
                Privacy
              </a>
              <a href="/dmca" className="hp-footer__link">
                DMCA
              </a>
              <a href="/2257" className="hp-footer__link">
                18 U.S.C. § 2257
              </a>
              <a href="/contact" className="hp-footer__link">
                Contact
              </a>
            </div>
          </div>
          <div className="hp-footer__bottom">
            <span className="hp-footer__logo">iku</span>
            <p className="hp-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg — All rights reserved.
              18+ only.
            </p>
          </div>
        </footer>
      </main>
    </Wrapper>
  );
}
