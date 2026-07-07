import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { notFound } from "next/navigation";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { buildGridInterleave } from "@/components/GridAds";
import { Pagination } from "@/components/Pagination";
import { getVideos, countVideos, isBannedTag } from "@/lib/content";
import { SORT_OPTIONS, parseSort } from "@/lib/sort-options";
import { getEntitySeo } from "@/lib/entity-seo";
import { EntityStatsPanel } from "@/components/EntityStatsPanel";
import { getNonce } from "@/lib/csp-nonce";
import { shouldBlockTaxonomy } from "@/lib/taxonomy-guard";
import { SERIES, getSeriesBySlug, type Series } from "@/data/series";
import { getCharacterBySlug } from "@/data/characters";
import pool from "@/lib/db";
import type { Metadata } from "next";

/**
 * Resolve a series slug. Falls back to a synthesized "virtual series" for
 * copyright tags that aren't in the static SERIES dataset — this lets users
 * hit /series/genshin_impact, /series/overwatch, /series/blue_archive, etc
 * without us having to hand-write entries for every 3D game franchise.
 *
 * The virtual series is only returned if the copyright has at least one
 * video in PG (filtered against banned content). Slug is both human-friendly
 * ("genshin-impact") and booru-raw ("genshin_impact") — we check both.
 */
async function resolveSeries(slug: string): Promise<Series | null> {
  const existing = getSeriesBySlug(slug);
  if (existing) return existing;

  // Reject obviously invalid slugs
  if (!slug || slug.length < 2 || slug.length > 80) return null;
  if (!/^[a-z0-9_\-():%]+$/i.test(decodeURIComponent(slug))) return null;

  // Try the slug as a raw copyright tag (e.g. "genshin_impact", "honkai:_star_rail")
  const decoded = decodeURIComponent(slug);
  const candidates = Array.from(
    new Set([decoded, decoded.replace(/-/g, "_"), decoded.replace(/_/g, "-")]),
  );

  try {
    const { rows } = await pool.query<{ copyright: string; count: number }>(
      `SELECT copyright, COUNT(*)::int AS count
       FROM (SELECT unnest(copyrights) AS copyright FROM videos) t
       WHERE copyright = ANY($1::text[])
       GROUP BY copyright
       ORDER BY count DESC
       LIMIT 1`,
      [candidates],
    );
    if (rows.length === 0 || rows[0].count < 10) return null;

    const canonical = rows[0].copyright;
    const displayName = canonical
      .replace(/_/g, " ")
      .replace(/:/g, "")
      .trim()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return {
      slug,
      name: displayName,
      description: `${displayName} has become a dominant franchise in the 3D animation and fan-art scene, with ${rows[0].count.toLocaleString()} videos on iku.gg covering its most-requested characters. Expect a mix of SFM compilations, game-engine animations, HMV, and short clips featuring the cast across the full range of content styles the ${displayName} community has produced.`,
      tags: [canonical],
      characters: [],
      seoTitle: `${displayName} Hentai — 3D Animations, SFM & Fan Porn | iku.gg`,
      seoDescription: `Watch ${rows[0].count.toLocaleString()}+ free ${displayName} hentai videos. 3D animations, SFM compilations, HMV and fan porn featuring all your favorite ${displayName} characters.`,
    };
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// force-dynamic because this page awaits searchParams for pagination/sort.
// generateStaticParams was removed — under force-dynamic it's inert and
// just confuses future readers.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isBannedTag(slug)) {
    return {
      title: "Not Found | iku.gg",
      robots: { index: false, follow: false },
    };
  }
  const sp = await searchParams;
  const series = await resolveSeries(slug);
  if (!series) return { title: "Series Not Found | iku.gg" };

  const page = parseInt(typeof sp.page === "string" ? sp.page : "1") || 1;
  const canonical =
    page > 1
      ? `https://iku.gg/series/${slug}?page=${page}`
      : `https://iku.gg/series/${slug}`;

  // Count-injected title. Same rationale as /tag and /character: the stored
  // series.seoTitle is boilerplate ("{Name} Hentai — Best Videos & Fan
  // Animation") which all 23 hand-curated series share, so desktop CTR
  // suffers. The precomputed count is a real trust signal.
  let count = 0;
  try {
    const seriesTag = series.tags[0] || slug.replace(/-/g, "_");
    count = await countVideos({ tags: seriesTag, requireThumbnail: true });
  } catch {
    /* fall through to stored seoTitle */
  }
  const countStr = count > 0 ? count.toLocaleString("en-US") : "";

  const pageTitle = (() => {
    if (page > 1) return `${series.name} Hentai — Page ${page} | iku.gg`;
    if (count > 0)
      return `${series.name} Hentai — ${countStr} Free HD Clips | iku.gg`;
    return series.seoTitle;
  })();

  const pageDescription =
    count > 0
      ? `Stream ${countStr} free ${series.name} hentai clips in HD. Animated videos updated daily, no sign-up. All ${series.name} characters on iku.gg.`
      : series.seoDescription;

  const socialTitle =
    count > 0
      ? `${series.name} Hentai — ${countStr} Free Clips`
      : `${series.name} Hentai Videos`;

  return {
    title: pageTitle,
    description: pageDescription,
    other: { rating: "adult" },
    alternates: { canonical },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: socialTitle,
      description: pageDescription,
      siteName: "iku.gg",
      type: "website",
      images: [
        {
          url: "https://iku.gg/og-default.png",
          width: 1200,
          height: 630,
          alt: `${series.name} Hentai on iku.gg`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: pageDescription,
      images: ["https://iku.gg/og-default.png"],
    },
  };
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const h = await headers();
  const ip =
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown";
  if (shouldBlockTaxonomy(ip)) {
    return (
      <main style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Too many requests</h1>
        <p>Slow down. Try again in a minute.</p>
      </main>
    );
  }

  const nonce = await getNonce();
  const { slug } = await params;
  if (isBannedTag(slug)) notFound();
  const sp = await searchParams;
  const series = await resolveSeries(slug);
  if (!series) notFound();

  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";
  const currentPage = Math.max(1, parseInt(pageParam));
  const order = parseSort(sortParam, "score");

  const [{ data: videos, hasMore }, totalCount, entitySeo] = await Promise.all([
    getVideos({
      tags: series.tags[0],
      page: currentPage,
      limit: 20,
      order,
      requireThumbnail: true,
    }),
    countVideos({ tags: series.tags[0], requireThumbnail: true }),
    getEntitySeo("series", series.tags[0]),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

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
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://iku.gg",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Series",
        item: "https://iku.gg/series",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: series.name,
        item: `https://iku.gg/series/${slug}`,
      },
    ],
  };

  return (
    <div className="shell-content">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        <div className="page-container">
          {/* ── Series hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <nav
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-tertiary)",
                marginBottom: "8px",
              }}
            >
              <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>
                Home
              </Link>
              {" / "}
              <Link
                href="/series"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Series
              </Link>
              {" / "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                {series.name}
              </span>
            </nav>
            <p className="tag-hero__label">Hentai Series</p>
            <h1 className="tag-hero__title">
              {series.name} Hentai — Best Videos &amp; Fan Animation
            </h1>

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
                <strong>
                  {SORT_OPTIONS.find((s) => s.value === order)?.label}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Description (entity_seo PG-backed if available) ─ */}
          <section className="page-section">
            {entitySeo ? (
              <div style={{ maxWidth: "720px" }}>
                {entitySeo.intro.split("\n\n").map((para, i) => (
                  <p
                    key={i}
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "var(--text-sm)",
                      lineHeight: 1.7,
                      marginBottom: "12px",
                    }}
                  >
                    {para}
                  </p>
                ))}
                <EntityStatsPanel meta={entitySeo.meta} type="series" />
                {entitySeo.faq.length > 0 && (
                  <div className="watch-faq" style={{ marginTop: "24px" }}>
                    <h2 className="watch-faq__heading">
                      Frequently asked questions
                    </h2>
                    {entitySeo.faq.map((item, i) => (
                      <details key={i} className="watch-faq__item">
                        <summary className="watch-faq__q">{item.q}</summary>
                        <div className="watch-faq__a">{item.a}</div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.7,
                  maxWidth: "720px",
                }}
              >
                {series.description}
              </p>
            )}
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
                {seriesCharacters.map(
                  (ch) =>
                    ch && (
                      <Link
                        key={ch.slug}
                        href={`/character/${ch.slug}`}
                        className="tag-pill tag-pill--dark"
                      >
                        {ch.name}
                      </Link>
                    ),
                )}
              </div>
            </section>
          )}
          {/* ── Sort filter bar ───────────────────────────────── */}
          <nav className="sort-tabs" aria-label="Sort videos">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/series/${slug}?sort=${opt.value}&page=1`}
                className={`filter-chip${order === opt.value ? " filter-chip--active" : ""}`}
                aria-current={order === opt.value ? "page" : undefined}
              >
                {opt.label}
              </Link>
            ))}
          </nav>

          {/* Listing ad — HilltopAds 300x250 above the grid */}
          <div style={{ margin: "16px auto 24px" }}>
            <HilltopAdsBanner />
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
            <>
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
                <span className="hp-premium-strip__cta">
                  Premium 4.99€/mo →
                </span>
              </Link>
              <BlacklistFilter
                videos={videos}
                interleave={buildGridInterleave("series")}
              />

              {/* AI bottom — Candy.AI after the grid, before pagination. */}
              <div style={{ margin: "24px auto" }}>
                <AdRotationBanner slug="candy-ai" surface="series-bottom" />
              </div>

              {/* Soulkyn vertical 4:5 — paired direct-affiliate slot. */}
              <div style={{ margin: "24px auto 32px" }}>
                <SoulkynVerticalAd surface="series-bottom-vertical" />
              </div>
            </>
          )}

          {/* ── Pagination ───────────────────────────────────── */}
          {videos.length > 0 && (
            <div style={{ marginTop: "40px", marginBottom: "48px" }}>
              <Suspense>
                <Pagination
                  currentPage={currentPage}
                  hasNextPage={hasMore}
                  totalPages={totalPages}
                />
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
                <span className="tag-crosslink-card__title">
                  All Hentai Characters
                </span>
                <span className="tag-crosslink-card__cta">
                  Browse characters →
                </span>
              </Link>
              <Link href="/series" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Directory</span>
                <span className="tag-crosslink-card__title">
                  All Hentai Series
                </span>
                <span className="tag-crosslink-card__cta">Browse series →</span>
              </Link>
              <Link href="/tags" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Tags</span>
                <span className="tag-crosslink-card__title">
                  Browse All Tags
                </span>
                <span className="tag-crosslink-card__cta">View tags →</span>
              </Link>
            </div>
          </section>
        </div>

        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms" className="site-footer__link">
                Terms
              </a>
              <a href="/privacy" className="site-footer__link">
                Privacy
              </a>
              <a href="/dmca" className="site-footer__link">
                DMCA
              </a>
              <a href="/2257" className="site-footer__link">
                18 U.S.C. § 2257
              </a>
              <a href="/contact" className="site-footer__link">
                Contact
              </a>
            </div>
            <p className="site-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
