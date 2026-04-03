import type { Metadata } from "next";
import Link from "next/link";
import { getVideos } from "@/lib/content";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { AgeGate } from "@/components/AgeGate";
import { BlacklistFilter } from "@/components/BlacklistFilter";

export const metadata: Metadata = {
  title: "Explore All Hentai Videos — 65,000+ Free Animated Clips | iku.gg",
  description:
    "Explore the largest collection of free hentai videos. 65,000+ animated hentai clips sorted by score, newest, and favorites. Stream hentai online.",
  other: { rating: "adult" },
};

type SortOption = "score" | "date" | "favcount";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score",    label: "Top Rated" },
  { value: "date",     label: "Newest" },
  { value: "favcount", label: "Most Saved" },
];

const PER_PAGE = 40;

export default async function ExplorePage(props: {
  searchParams: Promise<{ page?: string; sort?: string; source?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const sort = (SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.value ||
    "score") as SortOption;

  // Both sources — Gelbooru videos proxied through /api/proxy
  const { data: videos, hasMore } = await getVideos({
    limit: PER_PAGE,
    page,
    order: sort,
    source: "all",
  });

  /* Compute page window — 7 pages centered on current */
  const windowStart = Math.max(1, page - 3);
  const windowEnd   = windowStart + 6;
  const pageNumbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <AgeGate>
      <main className="shell-content">
        <div className="page-container">
          {/* ── Header ──────────────────────────────────── */}
          <div className="explore-header">
            <h1 className="explore-header__title">
              Explore Hentai
            </h1>
            <p className="explore-header__sub">
              {page === 1 ? "65,000+" : `Page ${page} ·`} free animated hentai videos
            </p>
          </div>

          {/* ── Sort bar ─────────────────────────────────── */}
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


          {/* ── Video grid ───────────────────────────────── */}
          <BlacklistFilter videos={videos} />

          {/* ── Empty state ──────────────────────────────── */}
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

          {/* ── Pagination — circle style ────────────────── */}
          <nav className="pagination-v2" aria-label="Pagination">
            {/* Previous */}
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

            {/* Leading ellipsis */}
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

            {/* Page numbers */}
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

            {/* Trailing ellipsis */}
            {hasMore && windowEnd < page + 6 && (
              <span
                className="pagination-v2__btn"
                style={{ color: "rgba(255,255,255,0.2)", pointerEvents: "none", cursor: "default" }}
              >
                …
              </span>
            )}

            {/* Next */}
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
