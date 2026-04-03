import type { Metadata } from "next";
import Link from "next/link";
import { getVideos } from "@/lib/content";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { AgeGate } from "@/components/AgeGate";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { CHARACTERS } from "@/data/characters";
import { SERIES } from "@/data/series";

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
    title: page > 1
      ? `Explore Hentai Videos — Page ${page} | iku.gg`
      : "Explore All Hentai Videos — 57,000+ Free Animated Clips | iku.gg",
    description: "Explore the largest collection of free hentai videos. 57,000+ animated hentai clips sorted by score, newest, and favorites. Browse by character, series, or tag.",
    other: { rating: "adult" },
    alternates: {
      canonical,
      types: {
        ...(prev ? { "prev": prev } : {}),
        ...(next ? { "next": next } : {}),
      },
    },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

type SortOption = "score" | "date" | "favcount";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score",    label: "Top Rated" },
  { value: "date",     label: "Newest" },
  { value: "favcount", label: "Most Saved" },
];

const PER_PAGE = 40;

/*
  Gradient palette — one per category hub card, cycling through
  distinct hues so the grid looks like a real discovery page.
*/
const HUB_CARDS = [
  {
    label: "Popular Characters",
    sub: "Iconic waifus ranked by fans",
    href: "/character",
    gradient: "linear-gradient(135deg, #e8467c 0%, #7b2ff7 100%)",
    icon: "★",
  },
  {
    label: "Popular Series",
    sub: "Naruto, One Piece, Genshin & more",
    href: "/series",
    gradient: "linear-gradient(135deg, #ff6b35 0%, #e8467c 100%)",
    icon: "▶",
  },
  {
    label: "Trending Now",
    sub: "What's hot this week",
    href: "/trending",
    gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    icon: "↑",
  },
  {
    label: "New Releases",
    sub: "Fresh uploads daily",
    href: "/new",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    icon: "✦",
  },
  {
    label: "Tags",
    sub: "Search by kink or aesthetic",
    href: "/tags",
    gradient: "linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)",
    icon: "#",
  },
  {
    label: "Swipe Feed",
    sub: "Infinite vertical scroll",
    href: "/feed",
    gradient: "linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)",
    icon: "⬆",
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
  const sort = (SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.value ||
    "score") as SortOption;

  const { data: videos, hasMore } = await getVideos({
    limit: PER_PAGE,
    page,
    order: sort,
    source: "all",
  });

  const windowStart = Math.max(1, page - 3);
  const windowEnd   = windowStart + 6;
  const pageNumbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <AgeGate>
      <main className="shell-content">
        <div className="page-container">

          {/* ── Page header ───────────────────────────────── */}
          <div className="explore-header">
            <h1 className="explore-header__title">Explore</h1>
            <p className="explore-header__sub">
              57,000+ free animated hentai videos — browse by character, series, or vibe
            </p>
          </div>

          {/* ════════════════════════════════════════════════
              SECTION 1 — Category hub cards
              Six large clickable cards, gradient backgrounds.
          ════════════════════════════════════════════════ */}
          <section className="ex-hub" aria-label="Browse categories">
            <div className="ex-hub__grid">
              {HUB_CARDS.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="ex-hub-card"
                  style={{ background: card.gradient }}
                >
                  <span className="ex-hub-card__icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <strong className="ex-hub-card__label">{card.label}</strong>
                  <span className="ex-hub-card__sub">{card.sub}</span>
                  <span className="ex-hub-card__arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              SECTION 2 — Popular Characters scroll row
          ════════════════════════════════════════════════ */}
          <section className="ex-feature-section" aria-label="Popular characters">
            <div className="ex-feature-section__head">
              <h2 className="ex-feature-section__title">Popular Characters</h2>
              <Link href="/character" className="ex-feature-section__more">
                See all →
              </Link>
            </div>

            <div className="ex-scroll-row" role="list">
              {FEATURED_CHARS.map((char, i) => (
                <Link
                  key={char.slug}
                  href={`/character/${char.slug}`}
                  className="v2-char-card"
                  role="listitem"
                  aria-label={`${char.name} — ${char.seriesName}`}
                >
                  {/* Circular gradient avatar */}
                  <div
                    className="v2-char-card__avatar"
                    style={{ background: CHAR_GRADIENTS[i % CHAR_GRADIENTS.length] }}
                  >
                    <span className="v2-char-card__initials">
                      {initials(char.name)}
                    </span>
                  </div>
                  <div className="v2-char-card__name">{char.name}</div>
                  <div className="v2-char-card__count">{char.seriesName}</div>
                </Link>
              ))}
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
              {FEATURED_SERIES.map((s, i) => (
                <Link
                  key={s.slug}
                  href={`/series/${s.slug}`}
                  className="ex-series-card"
                  role="listitem"
                  aria-label={s.name}
                  style={{ background: SERIES_GRADIENTS[i % SERIES_GRADIENTS.length] }}
                >
                  {/* Decorative faint title watermark */}
                  <span className="ex-series-card__watermark" aria-hidden="true">
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="ex-series-card__content">
                    <strong className="ex-series-card__name">{s.name}</strong>
                    <span className="ex-series-card__chars">
                      {s.characters.length} character{s.characters.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </Link>
              ))}
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
            <nav className="sort-bar" aria-label="Sort options">
              {SORT_OPTIONS.map((opt) => (
                <Link
                  key={opt.value}
                  href={`/explore?sort=${opt.value}&page=1`}
                  className={`sort-pill${sort === opt.value ? " sort-pill--active" : ""}`}
                  aria-current={sort === opt.value ? "page" : undefined}
                >
                  {opt.label}
                </Link>
              ))}
            </nav>

            {/* Video grid */}
            <BlacklistFilter videos={videos} />

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
                  <Link href={`/explore?sort=${sort}&page=1`} className="pagination-v2__btn">1</Link>
                  {windowStart > 2 && (
                    <span
                      className="pagination-v2__btn"
                      style={{ color: "rgba(255,255,255,0.2)", pointerEvents: "none", cursor: "default" }}
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
                  style={{ color: "rgba(255,255,255,0.2)", pointerEvents: "none", cursor: "default" }}
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
        </div>

        <footer className="site-footer">
          <div className="page-container">
            <p className="site-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg — For adults 18+ only.
            </p>
          </div>
        </footer>
      </main>
    </AgeGate>
  );
}
