import Link from "next/link";
import { Suspense } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { Pagination } from "@/components/Pagination";
import { searchPosts } from "@/lib/danbooru";
import type { Video } from "@/types/video";

interface TagPageProps {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: TagPageProps) {
  const { tag } = await params;
  const label   = tag.replace(/_/g, " ");
  return {
    title: `${label} — iku.gg`,
    description: `Watch the best ${label} animated videos on iku.`,
    robots: { index: false },
  };
}

const SORT_OPTIONS = [
  { value: "score",    label: "Top rated"  },
  { value: "date",     label: "Newest"     },
  { value: "favcount", label: "Most saved" },
];

const RELATED_TAGS = [
  "animated", "solo", "outdoors", "original", "school_uniform",
  "bunny_girl", "maid", "elf", "demon_girl", "catgirl",
  "nurse", "fantasy", "pov", "swimwear",
];

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { tag }                = await params;
  const { page = "1", sort = "score" } = await searchParams;

  const currentPage = Math.max(1, parseInt(page));
  const label       = tag.replace(/_/g, " ");
  const order       = (sort === "date" || sort === "favcount" || sort === "score") ? sort : "score";

  return (
    <div>
      {/* ── Header ───────────────────────────────────────── */}
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-header__logo">iku</Link>
          <div className="site-header__search-wrap">
            <Suspense>
              <SearchBar defaultValue={label} />
            </Suspense>
          </div>
          <nav className="site-header__nav">
            <Link href="/"       className="nav-link">Feed</Link>
            <Link href="/browse" className="nav-link">Browse</Link>
            <Link href="/tags"   className="nav-link nav-link--active">Tags</Link>
          </nav>
        </div>
      </header>

      <main>
        <div className="page-container">
          {/* ── Tag hero ──────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Tag</p>
            <h1 className="tag-hero__title">{label}</h1>

            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong>
              </span>
              <span className="tag-hero__stat">
                Sorted by <strong>{SORT_OPTIONS.find(s => s.value === order)?.label}</strong>
              </span>
            </div>
          </div>

          {/* ── Filter bar ────────────────────────────────── */}
          <div className="filter-bar">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/tags/${tag}?sort=${opt.value}&page=1`}
                className={`filter-chip${order === opt.value ? " filter-chip--active" : ""}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* ── Video grid ────────────────────────────────── */}
          <Suspense key={`${tag}-${currentPage}-${order}`} fallback={<SkeletonGrid count={20} />}>
            <TagVideoGrid tag={tag} page={currentPage} order={order} />
          </Suspense>

          {/* ── Pagination ────────────────────────────────── */}
          <div style={{ marginTop: "40px", marginBottom: "48px" }}>
            <Suspense>
              <Pagination
                currentPage={currentPage}
                hasNextPage={true}
              />
            </Suspense>
          </div>

          {/* ── Related tags ──────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Related tags
              </h2>
            </div>
            <div className="tag-grid">
              {RELATED_TAGS.filter((t) => t !== tag).map((t) => (
                <Link key={t} href={`/tags/${t}`} className="tag-pill tag-pill--dark">
                  {t.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms"   className="site-footer__link">Terms</a>
              <a href="/privacy" className="site-footer__link">Privacy</a>
              <a href="/dmca"    className="site-footer__link">DMCA</a>
            </div>
            <p className="site-footer__copy">&copy; {new Date().getFullYear()} iku.gg</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── Real data server component ─────────────────────────────── */

async function TagVideoGrid({
  tag,
  page,
  order,
}: {
  tag: string;
  page: number;
  order: "score" | "date" | "favcount";
}) {
  const { data: videos, hasMore } = await searchPosts({
    tags: tag,
    page,
    limit: 20,
    order,
  });

  if (!videos.length) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "var(--color-text-tertiary)" }}>
        <p style={{ fontSize: "var(--text-base)" }}>No videos found for &ldquo;{tag.replace(/_/g, " ")}&rdquo;</p>
        <Link href="/browse" className="btn btn-ghost btn-sm" style={{ marginTop: "16px", display: "inline-flex" }}>
          Browse all
        </Link>
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video: Video) => (
        <ThumbnailCard key={video.id} video={video} />
      ))}
    </div>
  );
}
