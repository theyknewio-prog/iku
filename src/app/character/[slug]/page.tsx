import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { Pagination } from "@/components/Pagination";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { searchPosts } from "@/lib/danbooru";
import { CHARACTERS, getCharacterBySlug } from "@/data/characters";
import { getSeriesBySlug } from "@/data/series";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 3600;

export function generateStaticParams() {
  return CHARACTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const character = getCharacterBySlug(slug);
  if (!character) return { title: "Character Not Found | iku.gg" };

  const page = parseInt(typeof sp.page === "string" ? sp.page : "1") || 1;
  const canonical = page > 1
    ? `https://iku.gg/character/${slug}?page=${page}`
    : `https://iku.gg/character/${slug}`;

  return {
    title: page > 1
      ? `${character.name} Hentai — Page ${page} | iku.gg`
      : character.seoTitle,
    description: character.seoDescription,
    other: { rating: "adult" },
    alternates: { canonical },
    robots: page > 1 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `${character.name} Hentai Videos | iku.gg`,
      description: character.seoDescription,
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

export default async function CharacterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const character = getCharacterBySlug(slug);
  if (!character) notFound();

  const series = getSeriesBySlug(character.series);
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";
  const currentPage = Math.max(1, parseInt(pageParam));
  const order =
    sortParam === "date" || sortParam === "favcount" || sortParam === "score" ? sortParam : "score";

  const { data: videos, hasMore } = await searchPosts({
    tags: character.tags[0],
    page: currentPage,
    limit: 20,
    order,
  });

  const relatedChars = character.relatedCharacters
    .map((s) => getCharacterBySlug(s))
    .filter(Boolean);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: character.name,
    description: character.seoDescription,
    url: `https://iku.gg/character/${slug}`,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://iku.gg" },
      { "@type": "ListItem", position: 2, name: "Characters", item: "https://iku.gg/character" },
      { "@type": "ListItem", position: 3, name: character.name, item: `https://iku.gg/character/${slug}` },
    ],
  };

  return (
    <div className="shell-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <div className="page-container">
          {/* ── Character hero ──────────────────────────────────── */}
          <div className="tag-hero">
            <nav style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginBottom: "8px" }}>
              <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>Home</Link>
              {" / "}
              <Link href="/character" style={{ color: "var(--color-text-tertiary)" }}>Characters</Link>
              {" / "}
              <span style={{ color: "var(--color-text-secondary)" }}>{character.name}</span>
            </nav>
            <p className="tag-hero__label">Hentai Character</p>
            <h1 className="tag-hero__title">{character.name} Hentai — Best Videos &amp; Fan Animation</h1>

            {series && (
              <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", marginTop: "4px" }}>
                From{" "}
                <Link href={`/series/${series.slug}`} style={{ color: "var(--color-accent)", textDecoration: "underline" }}>
                  {series.name}
                </Link>
              </p>
            )}

            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong>
              </span>
              <span className="tag-hero__stat">
                {videos.length} <strong>hentai videos</strong>
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
              {character.description}
            </p>
          </section>

          {/* ── Sort filter bar ───────────────────────────────── */}
          <div className="filter-bar">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/character/${slug}?sort=${opt.value}&page=1`}
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
                No hentai videos found for {character.name}
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

          {/* ── Related characters ────────────────────────────── */}
          {relatedChars.length > 0 && (
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  Related Characters
                </h2>
              </div>
              <div className="tag-grid">
                {relatedChars.map((rc) => rc && (
                  <Link
                    key={rc.slug}
                    href={`/character/${rc.slug}`}
                    className="tag-pill tag-pill--dark"
                  >
                    {rc.name}
                    <span className="tag-pill__count">{rc.seriesName}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Series link ──────────────────────────────────── */}
          {series && (
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  More from {series.name}
                </h2>
              </div>
              <div className="tag-crosslinks">
                <Link href={`/series/${series.slug}`} className="tag-crosslink-card">
                  <span className="tag-crosslink-card__label">Series</span>
                  <span className="tag-crosslink-card__title">{series.name} Hentai</span>
                  <span className="tag-crosslink-card__cta">View all videos →</span>
                </Link>
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
              </div>
            </section>
          )}
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
