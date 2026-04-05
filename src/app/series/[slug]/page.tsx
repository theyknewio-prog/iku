import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { Pagination } from "@/components/Pagination";
import { getVideos } from "@/lib/content";
import { getNonce } from "@/lib/csp-nonce";
import { SERIES, getSeriesBySlug } from "@/data/series";
import { getCharacterBySlug } from "@/data/characters";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SERIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const series = getSeriesBySlug(slug);
  if (!series) return { title: "Series Not Found | iku.gg" };

  const page = parseInt(typeof sp.page === "string" ? sp.page : "1") || 1;
  const canonical = page > 1
    ? `https://iku.gg/series/${slug}?page=${page}`
    : `https://iku.gg/series/${slug}`;

  return {
    title: page > 1
      ? `${series.name} Hentai — Page ${page} | iku.gg`
      : series.seoTitle,
    description: series.seoDescription,
    other: { rating: "adult" },
    alternates: { canonical },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `${series.name} Hentai Videos | iku.gg`,
      description: series.seoDescription,
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

export default async function SeriesPage({ params, searchParams }: Props) {
  const nonce = await getNonce();
  const { slug } = await params;
  const sp = await searchParams;
  const series = getSeriesBySlug(slug);
  if (!series) notFound();

  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";
  const currentPage = Math.max(1, parseInt(pageParam));
  const order =
    sortParam === "date" || sortParam === "favcount" || sortParam === "score" ? sortParam : "score";

  const { data: videos, hasMore } = await getVideos({
    tags: series.tags[0],
    page: currentPage,
    limit: 20,
    order,
    requireThumbnail: true,
  });

  const seriesCharacters = series.characters
    .map((s) => getCharacterBySlug(s))
    .filter(Boolean);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${series.name} Hentai Videos`,
    description: series.seoDescription,
    url: `https://iku.gg/series/${slug}`,
    isPartOf: { "@type": "WebSite", name: "iku.gg", url: "https://iku.gg" },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://iku.gg" },
      { "@type": "ListItem", position: 2, name: "Series", item: "https://iku.gg/series" },
      { "@type": "ListItem", position: 3, name: series.name, item: `https://iku.gg/series/${slug}` },
    ],
  };

  return (
    <div className="shell-content">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <div className="page-container">
          {/* ── Series hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <nav style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginBottom: "8px" }}>
              <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>Home</Link>
              {" / "}
              <Link href="/series" style={{ color: "var(--color-text-tertiary)" }}>Series</Link>
              {" / "}
              <span style={{ color: "var(--color-text-secondary)" }}>{series.name}</span>
            </nav>
            <p className="tag-hero__label">Hentai Series</p>
            <h1 className="tag-hero__title">{series.name} Hentai — Best Videos &amp; Fan Animation</h1>

            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong>
              </span>
              <span className="tag-hero__stat">
                {videos.length} <strong>hentai videos</strong>
              </span>
              <span className="tag-hero__stat">
                {series.characters.length} <strong>characters</strong>
              </span>
              <span className="tag-hero__stat">
                Sorted by{" "}
                <strong>{SORT_OPTIONS.find((s) => s.value === order)?.label}</strong>
              </span>
            </div>
          </div>

          {/* ── Description ──────────────────────────────────── */}
          <section className="page-section">
            <p style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.7,
              maxWidth: "720px",
            }}>
              {series.description}
            </p>
          </section>

          {/* ── Characters from this series ───────────────────── */}
          {seriesCharacters.length > 0 && (
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  {series.name} Characters
                </h2>
              </div>
              <div className="tag-grid">
                {seriesCharacters.map((ch) => ch && (
                  <Link
                    key={ch.slug}
                    href={`/character/${ch.slug}`}
                    className="tag-pill tag-pill--dark"
                  >
                    {ch.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Sort filter bar ───────────────────────────────── */}
          <div className="filter-bar">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/series/${slug}?sort=${opt.value}&page=1`}
                className={`filter-chip${order === opt.value ? " filter-chip--active" : ""}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* ── Video grid ────────────────────────────────────── */}
          {videos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 0", color: "var(--color-text-tertiary)" }}>
              <p style={{ fontSize: "var(--text-base)" }}>
                No hentai videos found for {series.name}
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

          {/* ── Cross-links ──────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Explore More
              </h2>
            </div>
            <div className="tag-crosslinks">
              <Link href="/character" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Directory</span>
                <span className="tag-crosslink-card__title">All Hentai Characters</span>
                <span className="tag-crosslink-card__cta">Browse characters →</span>
              </Link>
              <Link href="/series" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Directory</span>
                <span className="tag-crosslink-card__title">All Hentai Series</span>
                <span className="tag-crosslink-card__cta">Browse series →</span>
              </Link>
              <Link href="/tags" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Tags</span>
                <span className="tag-crosslink-card__title">Browse All Tags</span>
                <span className="tag-crosslink-card__cta">View tags →</span>
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
