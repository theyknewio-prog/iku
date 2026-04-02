import type { Metadata } from "next";
import Link from "next/link";
import { searchPosts } from "@/lib/danbooru";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { AgeGate } from "@/components/AgeGate";

export const metadata: Metadata = {
  title: "Explore All Hentai Videos — 65,000+ Free Animated Clips | iku.gg",
  description:
    "Explore the largest collection of free hentai videos. 65,000+ animated hentai clips sorted by score, newest, and favorites. Stream hentai online.",
  other: { rating: "adult" },
};

type SortOption = "score" | "date" | "favcount";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score", label: "Top Rated" },
  { value: "date", label: "Newest" },
  { value: "favcount", label: "Most Saved" },
];

const PER_PAGE = 40;

export default async function ExplorePage(props: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const sort = (SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.value ||
    "score") as SortOption;

  const { data: videos, hasMore } = await searchPosts({
    limit: PER_PAGE,
    page,
    order: sort,
  });

  return (
    <AgeGate>
      <main className="shell-content">
        <div className="page-container">
          {/* Header */}
          <div style={{ paddingTop: "24px", paddingBottom: "16px" }}>
            <h1
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--color-text-primary)",
                marginBottom: "4px",
              }}
            >
              Explore Hentai
            </h1>
            <p style={{ fontSize: "14px", color: "var(--color-text-tertiary)" }}>
              {page === 1 ? "65,000+" : `Page ${page} ·`} free animated hentai videos
            </p>
          </div>

          {/* Sort bar */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/explore?sort=${opt.value}${page > 1 ? `&page=1` : ""}`}
                className="tag-pill"
                style={{
                  background:
                    sort === opt.value
                      ? "rgba(255,32,128,0.2)"
                      : "rgba(255,255,255,0.08)",
                  color: sort === opt.value ? "#ff2080" : "#ccc",
                  fontWeight: sort === opt.value ? 600 : 400,
                  textDecoration: "none",
                  padding: "6px 14px",
                  fontSize: "13px",
                }}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Video grid */}
          <div className="video-grid">
            {videos.map((video, i) => (
              <ThumbnailCard
                key={video.id}
                video={video}
                priority={i < 8}
                lazy={i >= 8}
              />
            ))}
          </div>

          {/* Empty state */}
          {videos.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p>No videos found.</p>
            </div>
          )}

          {/* Pagination */}
          <nav
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "8px",
              padding: "32px 0",
              flexWrap: "wrap",
            }}
            aria-label="Pagination"
          >
            {page > 1 && (
              <Link
                href={`/explore?sort=${sort}&page=${page - 1}`}
                className="tag-pill"
                style={{
                  textDecoration: "none",
                  padding: "8px 16px",
                  fontSize: "13px",
                }}
              >
                ← Previous
              </Link>
            )}

            {/* Page numbers */}
            {Array.from({ length: Math.min(7, page + 3) }, (_, i) => {
              const p = Math.max(1, page - 3) + i;
              if (p < 1) return null;
              return (
                <Link
                  key={p}
                  href={`/explore?sort=${sort}&page=${p}`}
                  className="tag-pill"
                  style={{
                    textDecoration: "none",
                    padding: "8px 14px",
                    fontSize: "13px",
                    background:
                      p === page
                        ? "rgba(255,32,128,0.25)"
                        : "rgba(255,255,255,0.08)",
                    color: p === page ? "#ff2080" : "#ccc",
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </Link>
              );
            })}

            {hasMore && (
              <Link
                href={`/explore?sort=${sort}&page=${page + 1}`}
                className="tag-pill"
                style={{
                  textDecoration: "none",
                  padding: "8px 16px",
                  fontSize: "13px",
                }}
              >
                Next →
              </Link>
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
