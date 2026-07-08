import type { Metadata } from "next";
import Link from "next/link";
import { getVideos, getThumbnailsForTags } from "@/lib/content";
import { SORT_OPTIONS, parseSort, type SortValue } from "@/lib/sort-options";
import React from "react";
import { AgeGate } from "@/components/AgeGate";
import { isLikelyBot } from "@/lib/is-bot";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { CoverImage } from "@/components/CoverImage";
import { buildGridInterleave } from "@/components/GridAds";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { AdZoneClient } from "@/components/AdZoneClient";
import { AD_ZONES } from "@/lib/ad-config";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { SignupCTA } from "@/components/SignupCTA";
import { CHARACTERS } from "@/data/characters";
import { SERIES } from "@/data/series";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}): Promise<Metadata> {
  const sp = await props.searchParams;
  const page = parseInt(sp.page || "1") || 1;
  const sort = sp.sort || "score";
  const base = "https://iku.gg/explore";
  const canonical = page > 1 ? `${base}?sort=${sort}&page=${page}` : base;
  const prev = page > 1 ? `${base}?sort=${sort}&page=${page - 1}` : undefined;
  const next = `${base}?sort=${sort}&page=${page + 1}`;

  return {
    title:
      page > 1
        ? `Explore Hentai Videos — Page ${page} | iku.gg`
        : "Explore All Hentai Videos — 300,000+ Free Animated Clips | iku.gg",
    description:
      "Explore the largest collection of free hentai videos. 300,000+ animated hentai clips sorted by score, newest, and favorites. Browse by character, series, or tag.",
    other: { rating: "adult" },
    alternates: {
      canonical,
      types: {
        ...(prev ? { prev: prev } : {}),
        ...(next ? { next: next } : {}),
      },
    },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const PER_PAGE = 40;

/*
  Gradient palette — one per category hub card, cycling through
  distinct hues so the grid looks like a real discovery page.
*/
const HUB_CARDS = [
  {
    label: "Hentai (2D)",
    sub: "Full 2D anime episodes & OAV",
    href: "/hentai",
    gradient: "linear-gradient(135deg, #e8467c 0%, #7b2ff7 100%)",
    icon: "🌸",
  },
  {
    label: "3D & Cartoon Porn",
    sub: "SFM, Genshin, Overwatch & more",
    href: "/3d",
    gradient: "linear-gradient(135deg, #11998e 0%, #4776e6 100%)",
    icon: "🎮",
  },
  {
    label: "Shorts Feed",
    sub: "Swipe vertical video feed",
    href: "/feed",
    gradient: "linear-gradient(135deg, #f7971e 0%, #e8467c 100%)",
    icon: "⚡",
  },
  {
    label: "Trending Now",
    sub: "What's hot this week",
    href: "/trending",
    gradient: "linear-gradient(135deg, #ff6b35 0%, #c94b4b 100%)",
    icon: "🔥",
  },
  {
    label: "New Releases",
    sub: "Fresh uploads daily",
    href: "/new",
    gradient: "linear-gradient(135deg, #7b2ff7 0%, #4776e6 100%)",
    icon: "🆕",
  },
  {
    label: "Popular Characters",
    sub: "Chun-Li, Tifa, Ada, 2B & more",
    href: "/character",
    gradient: "linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)",
    icon: "👤",
  },
  {
    label: "Popular Series",
    sub: "Genshin, Overwatch, Blue Archive",
    href: "/series",
    gradient: "linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)",
    icon: "🎬",
  },
  {
    label: "All Tags",
    sub: "Browse by kink, genre & theme",
    href: "/tags",
    gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    icon: "🏷️",
  },
];

/*
  Per-character gradient — cycles through 8 accent pairs so each
  circular avatar has a unique colour without needing real images.
*/
const CHAR_GRADIENTS = [
  "linear-gradient(135deg, #e8467c, #7b2ff7)",
  "linear-gradient(135deg, #ff6b35, #e8467c)",
  "linear-gradient(135deg, #11998e, #38ef7d)",
  "linear-gradient(135deg, #4776e6, #8e54e9)",
  "linear-gradient(135deg, #f7971e, #ffd200)",
  "linear-gradient(135deg, #c94b4b, #4b134f)",
  "linear-gradient(135deg, #0f2027, #2c5364)",
  "linear-gradient(135deg, #7b2ff7, #4776e6)",
];

const SERIES_GRADIENTS = [
  "linear-gradient(160deg, #e8467c 0%, #7b2ff7 100%)",
  "linear-gradient(160deg, #ff6b35 0%, #c94b4b 100%)",
  "linear-gradient(160deg, #11998e 0%, #4776e6 100%)",
  "linear-gradient(160deg, #4776e6 0%, #8e54e9 100%)",
  "linear-gradient(160deg, #f7971e 0%, #e8467c 100%)",
  "linear-gradient(160deg, #c94b4b 0%, #4b134f 100%)",
  "linear-gradient(160deg, #0f2027 0%, #2c5364 100%)",
  "linear-gradient(160deg, #7b2ff7 0%, #e8467c 100%)",
];

/* Grab initials for the circular avatar fallback */
function initials(name: string): string {
  return name
    .split(/[\s-]/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* Top N characters/series to feature in the scroll rows */
const FEATURED_CHARS = CHARACTERS.slice(0, 16);
const FEATURED_SERIES = SERIES.slice(0, 12);

export default async function ExplorePage(props: {
  searchParams: Promise<{ page?: string; sort?: string; source?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const sort: SortValue = parseSort(searchParams.sort, "score");

  const { data: videos, hasMore } = await getVideos({
    limit: PER_PAGE,
    page,
    order: sort,
    source: "all",
  });

  // Source diversity: the revived gelbooru catalogue (~19.5K live) is
  // score-buried under rule34 (avg 6291 vs 1035) and never surfaces in any
  // score-sorted browse grid (audit 2026-07-08). Fetch a small gelbooru
  // slice and interleave it as real video cards so revived content is
  // reachable by navigation, not just direct URL. Page-level + additive —
  // zero change to the shared getVideos ordering / pagination.
  const { data: gelbooruMix } = await getVideos({
    limit: 4,
    page,
    order: sort,
    source: "gelbooru",
    requireThumbnail: true,
  });

  // Fetch real cover thumbnails in parallel for the hub cards, the character
  // scroll row, and the series scroll row. All batched via getThumbnailsForTags
  // which is memoized (1h TTL) — effectively free on warm cache.
  const charTags = FEATURED_CHARS.map((c) => c.tags[0]).filter(Boolean);
  const seriesTags = FEATURED_SERIES.map((s) => s.tags[0]).filter(Boolean);
  // Hub cards use one representative tag each (or a top video thumbnail for
  // the generic "Trending / New / Feed" hubs).
  const hubTags = [
    "tsunade_(naruto)", // Popular Characters → Tsunade (most iconic)
    "naruto", // Popular Series → Naruto top
    "animated", // Trending Now → animated top
    "original", // New Releases → generic
    "large_breasts", // Tags → aesthetic
    "animated", // Swipe Feed → reuse animated
  ];
  const [charThumbs, seriesThumbs, hubThumbs] = await Promise.all([
    getThumbnailsForTags(charTags),
    getThumbnailsForTags(seriesTags),
    getThumbnailsForTags(hubTags),
  ]);

  const windowStart = Math.max(1, page - 3);
  const windowEnd = windowStart + 6;
  const pageNumbers = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i,
  );

  const bot = await isLikelyBot();
  const Wrapper = bot ? React.Fragment : AgeGate;

  return (
    <Wrapper>
      <main className="shell-content">
        <div className="page-container">
          {/* ── Page header ───────────────────────────────── */}
          <div className="explore-header">
            <h1 className="explore-header__title">Explore</h1>
            <p className="explore-header__sub">
              300,000+ free animated hentai videos — browse by character,
              series, or vibe
            </p>
          </div>

          {/* ════════════════════════════════════════════════
              SECTION 1 — Category hub cards
              Six large clickable cards with real backdrop images
              layered behind a gradient tint for legibility.
          ════════════════════════════════════════════════ */}
          <section className="ex-hub" aria-label="Browse categories">
            <div className="ex-hub__grid">
              {HUB_CARDS.map((card, i) => {
                const thumb = hubThumbs[hubTags[i]] || "";
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="ex-hub-card ex-hub-card--with-image"
                    style={{ background: card.gradient }}
                  >
                    {thumb && (
                      <CoverImage
                        src={thumb}
                        alt=""
                        className="ex-hub-card__bg"
                      />
                    )}
                    <span className="ex-hub-card__icon" aria-hidden="true">
                      {card.icon}
                    </span>
                    <strong className="ex-hub-card__label">{card.label}</strong>
                    <span className="ex-hub-card__sub">{card.sub}</span>
                    <span className="ex-hub-card__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              SECTION 2 — Popular Characters scroll row
          ════════════════════════════════════════════════ */}
          <section
            className="ex-feature-section"
            aria-label="Popular characters"
          >
            <div className="ex-feature-section__head">
              <h2 className="ex-feature-section__title">Popular Characters</h2>
              <Link href="/character" className="ex-feature-section__more">
                See all →
              </Link>
            </div>

            <div className="ex-scroll-row" role="list">
              {FEATURED_CHARS.map((char, i) => {
                const thumb = charThumbs[char.tags[0]] || "";
                return (
                  <Link
                    key={char.slug}
                    href={`/character/${char.slug}`}
                    className="v2-char-card"
                    role="listitem"
                    aria-label={`${char.name} — ${char.seriesName}`}
                  >
                    {/* Circular avatar — real thumbnail when available,
                        gradient + initials fallback otherwise. */}
                    <div
                      className="v2-char-card__avatar"
                      style={{
                        background: CHAR_GRADIENTS[i % CHAR_GRADIENTS.length],
                      }}
                    >
                      {/* Initials always rendered underneath; CoverImage
                          overlays the thumb and unmounts itself on 404,
                          revealing the initials (dead-cover self-heal). */}
                      <span className="v2-char-card__initials">
                        {initials(char.name)}
                      </span>
                      {thumb && <CoverImage src={thumb} alt={char.name} />}
                    </div>
                    <div className="v2-char-card__name">{char.name}</div>
                    <div className="v2-char-card__count">{char.seriesName}</div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              SECTION 3 — Popular Series scroll row
          ════════════════════════════════════════════════ */}
          <section className="ex-feature-section" aria-label="Popular series">
            <div className="ex-feature-section__head">
              <h2 className="ex-feature-section__title">Popular Series</h2>
              <Link href="/series" className="ex-feature-section__more">
                See all →
              </Link>
            </div>

            <div className="ex-scroll-row ex-scroll-row--series" role="list">
              {FEATURED_SERIES.map((s, i) => {
                const thumb = seriesThumbs[s.tags[0]] || "";
                return (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}`}
                    className="ex-series-card ex-series-card--with-image"
                    role="listitem"
                    aria-label={s.name}
                    style={{
                      background: SERIES_GRADIENTS[i % SERIES_GRADIENTS.length],
                    }}
                  >
                    {/* Watermark always underneath; CoverImage overlays and
                        self-heals to it on 404 (dead gelbooru covers). */}
                    <span
                      className="ex-series-card__watermark"
                      aria-hidden="true"
                    >
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                    {thumb && (
                      <CoverImage
                        src={thumb}
                        alt=""
                        className="ex-series-card__bg"
                      />
                    )}
                    <div className="ex-series-card__content">
                      <strong className="ex-series-card__name">{s.name}</strong>
                      <span className="ex-series-card__chars">
                        {s.characters.length} character
                        {s.characters.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
          {/* ════════════════════════════════════════════════
              SECTION 4 — All Videos grid (existing, preserved)
          ════════════════════════════════════════════════ */}
          <section className="ex-videos-section" aria-label="All videos">
            <div className="ex-feature-section__head">
              <h2 className="ex-feature-section__title">All Videos</h2>
            </div>

            {/* Sort bar */}
            <nav className="sort-tabs" aria-label="Sort options">
              {SORT_OPTIONS.map((opt) => (
                <Link
                  key={opt.value}
                  href={`/explore?sort=${opt.value}&page=1`}
                  className={`filter-chip${sort === opt.value ? " filter-chip--active" : ""}`}
                  aria-current={sort === opt.value ? "page" : undefined}
                >
                  {opt.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/pricing"
              className="hp-premium-strip"
              aria-label="Get iku Premium"
            >
              <span className="hp-premium-strip__icon">🚫</span>
              <span className="hp-premium-strip__text">
                <strong>Skip every ad</strong> · 4K when available · Early
                access · Unlimited favorites
              </span>
              <span className="hp-premium-strip__cta">Premium 4.99€/mo →</span>
            </Link>

            {/* Listing ad — HilltopAds 300x250 above the grid */}
            <div style={{ margin: "16px auto 24px" }}>
              <HilltopAdsBanner />
            </div>

            {/* Video grid — ads + a diversity slice of revived gelbooru
                content woven in at content-only indices (offset from the
                ad indices so nothing stacks). */}
            <BlacklistFilter
              videos={videos}
              interleave={[
                ...buildGridInterleave("explore"),
                ...gelbooruMix.map((v, k) => ({
                  index: [3, 10, 24, 34][k] ?? 3 + k * 8,
                  node: <ThumbnailCard key={`gel-${v.id}`} video={v} />,
                })),
              ]}
            />

            {/* ExoClick native — CPM/CPC display after the grid (lazy). */}
            <AdZoneClient zoneId={AD_ZONES.nativeGrid} size="native" lazy />

            {/* AI bottom — Joi after the grid, before pagination. */}
            {videos.length > 0 && (
              <div style={{ margin: "24px auto 8px" }}>
                <AdRotationBanner slug="joi-ai" surface="explore-bottom" />
              </div>
            )}

            {/* Swipey 300x250 + Soulkyn vertical — variety stack. */}
            {videos.length > 0 && (
              <>
                <div style={{ margin: "16px auto" }}>
                  <AdRotationBanner slug="swipey" surface="explore-swipey" />
                </div>
                <div style={{ margin: "16px auto 24px" }}>
                  <SoulkynVerticalAd surface="explore-vertical" />
                </div>
              </>
            )}

            {/* Empty state */}
            {videos.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "14px",
                }}
              >
                No videos found.
              </div>
            )}

            {/* Pagination */}
            <nav className="pagination-v2" aria-label="Pagination">
              {page > 1 ? (
                <Link
                  href={`/explore?sort=${sort}&page=${page - 1}`}
                  className="pagination-v2__btn pagination-v2__btn--nav"
                  aria-label="Previous page"
                >
                  ← Prev
                </Link>
              ) : (
                <span
                  className="pagination-v2__btn pagination-v2__btn--nav"
                  style={{ opacity: 0.25, pointerEvents: "none" }}
                  aria-disabled="true"
                >
                  ← Prev
                </span>
              )}

              {windowStart > 1 && (
                <>
                  <Link
                    href={`/explore?sort=${sort}&page=1`}
                    className="pagination-v2__btn"
                  >
                    1
                  </Link>
                  {windowStart > 2 && (
                    <span
                      className="pagination-v2__btn"
                      style={{
                        color: "rgba(255,255,255,0.2)",
                        pointerEvents: "none",
                        cursor: "default",
                      }}
                    >
                      …
                    </span>
                  )}
                </>
              )}

              {pageNumbers.map((p) => (
                <Link
                  key={p}
                  href={`/explore?sort=${sort}&page=${p}`}
                  className={`pagination-v2__btn${p === page ? " pagination-v2__btn--active" : ""}`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </Link>
              ))}

              {hasMore && windowEnd < page + 6 && (
                <span
                  className="pagination-v2__btn"
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    pointerEvents: "none",
                    cursor: "default",
                  }}
                >
                  …
                </span>
              )}

              {hasMore ? (
                <Link
                  href={`/explore?sort=${sort}&page=${page + 1}`}
                  className="pagination-v2__btn pagination-v2__btn--nav"
                  aria-label="Next page"
                >
                  Next →
                </Link>
              ) : (
                <span
                  className="pagination-v2__btn pagination-v2__btn--nav"
                  style={{ opacity: 0.25, pointerEvents: "none" }}
                  aria-disabled="true"
                >
                  Next →
                </span>
              )}
            </nav>
          </section>

          {/* Signup CTA — shown only for anonymous visitors */}
          <SignupCTA placement="explore" />
        </div>

        <footer className="site-footer">
          <div className="page-container">
            <p className="site-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg — For adults 18+ only.
            </p>
          </div>
        </footer>
      </main>
    </Wrapper>
  );
}
