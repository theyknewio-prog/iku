import Link from "next/link";
import { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { Pagination } from "@/components/Pagination";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { searchPosts } from "@/lib/danbooru";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Pre-build the top 100 tags as static pages — instant load for visitors
export async function generateStaticParams() {
  try {
    const { getPopularTags, getPopularCharacters } = await import("@/lib/danbooru");
    const [tags, chars] = await Promise.all([
      getPopularTags(60),
      getPopularCharacters(40),
    ]);
    const allTags = [...tags, ...chars].map((t) => ({ tag: t.name }));
    return allTags;
  } catch {
    return [];
  }
}

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
  const sp = await searchParams;
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";

  const currentPage = Math.max(1, parseInt(pageParam));
  const label = tag.replace(/_/g, " ");
  const titleCased = label.replace(/\b\w/g, (c) => c.toUpperCase());
  const order =
    sortParam === "date" || sortParam === "favcount" || sortParam === "score" ? sortParam : "score";

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
            <BlacklistFilter videos={videos} />
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

          {/* ── Cross-links: Glossary & Blog ─────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Learn More
              </h2>
            </div>
            <div className="tag-crosslinks">
              <Link href="/glossary" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Glossary</span>
                <span className="tag-crosslink-card__title">What Does {titleCased} Mean?</span>
                <span className="tag-crosslink-card__cta">Read definition →</span>
              </Link>
              <Link href="/blog/understanding-hentai-tags" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Guide</span>
                <span className="tag-crosslink-card__title">Understanding Hentai Tags</span>
                <span className="tag-crosslink-card__cta">Read guide →</span>
              </Link>
              <Link href="/blog/what-is-hentai" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Blog</span>
                <span className="tag-crosslink-card__title">What is Hentai?</span>
                <span className="tag-crosslink-card__cta">Read article →</span>
              </Link>
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
