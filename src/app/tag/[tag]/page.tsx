import Link from "next/link";
import { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { Pagination } from "@/components/Pagination";
import { searchPosts } from "@/lib/danbooru";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const label = tag.replace(/_/g, " ");
  const titleCased = label.replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${titleCased} Hentai Videos - Best ${titleCased} Anime Porn | iku.gg`,
    description: `Watch the best ${label} hentai videos on iku.gg. Stream free ${label} animated hentai clips — top rated by score, sorted by date or favorites.`,
    other: { rating: "adult" },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${titleCased} Hentai Videos | iku.gg`,
      description: `Stream free ${label} hentai videos. The best ${label} animated hentai on iku.gg.`,
      siteName: "iku.gg",
      type: "website",
    },
  };
}

const SORT_OPTIONS = [
  { value: "score", label: "Top Rated" },
  { value: "date", label: "Newest" },
  { value: "favcount", label: "Most Saved" },
] as const;

const RELATED_TAGS = [
  "animated",
  "solo",
  "school_uniform",
  "bunny_girl",
  "maid",
  "elf",
  "demon_girl",
  "catgirl",
  "nurse",
  "pov",
  "swimwear",
  "fantasy",
  "original",
  "outdoors",
];

export default async function TagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  const { page = "1", sort = "score" } = await searchParams;

  const currentPage = Math.max(1, parseInt(String(page)));
  const label = tag.replace(/_/g, " ");
  const titleCased = label.replace(/\b\w/g, (c) => c.toUpperCase());
  const order =
    sort === "date" || sort === "favcount" || sort === "score" ? sort : "score";

  const { data: videos, hasMore } = await searchPosts({
    tags: tag,
    page: currentPage,
    limit: 20,
    order,
  });

  const relatedTags = RELATED_TAGS.filter((t) => t !== tag);

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* ── Tag hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Hentai Tag</p>
            <h1 className="tag-hero__title">{titleCased} Hentai Videos</h1>

            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong>
              </span>
              <span className="tag-hero__stat">
                {videos.length} <strong>hentai videos</strong>
              </span>
              <span className="tag-hero__stat">
                Sorted by{" "}
                <strong>
                  {SORT_OPTIONS.find((s) => s.value === order)?.label}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Sort filter bar ───────────────────────────────── */}
          <div className="filter-bar">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/tag/${tag}?sort=${opt.value}&page=1`}
                className={`filter-chip${order === opt.value ? " filter-chip--active" : ""}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* ── Video grid ────────────────────────────────────── */}
          {videos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p style={{ fontSize: "var(--text-base)" }}>
                No hentai videos found for &ldquo;{label}&rdquo;
              </p>
              <Link
                href="/trending"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: "16px", display: "inline-flex" }}
              >
                Browse trending hentai
              </Link>
            </div>
          ) : (
            <div className="video-grid">
              {videos.map((video: Video, i) => (
                <ThumbnailCard
                  key={video.id}
                  video={video}
                  priority={i < 4}
                  lazy={i >= 4}
                />
              ))}
            </div>
          )}

          {/* ── Pagination ───────────────────────────────────── */}
          {videos.length > 0 && (
            <div style={{ marginTop: "40px", marginBottom: "48px" }}>
              <Suspense>
                <Pagination currentPage={currentPage} hasNextPage={hasMore} />
              </Suspense>
            </div>
          )}

          {/* ── Related tags ─────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Related Hentai Tags
              </h2>
            </div>
            <div className="tag-grid">
              {relatedTags.map((t) => (
                <Link
                  key={t}
                  href={`/tag/${t}`}
                  className="tag-pill tag-pill--dark"
                >
                  {t.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms" className="site-footer__link">Terms</a>
              <a href="/privacy" className="site-footer__link">Privacy</a>
              <a href="/dmca" className="site-footer__link">DMCA</a>
            </div>
            <p className="site-footer__copy">&copy; {new Date().getFullYear()} iku.gg</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
