import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { Pagination } from "@/components/Pagination";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { buildGridInterleave } from "@/components/GridAds";
import { notFound } from "next/navigation";
import { getVideos, countVideos, isBannedTag } from "@/lib/content";
import { SORT_OPTIONS, parseSort } from "@/lib/sort-options";
import { getEntitySeo } from "@/lib/entity-seo";
import { EntityStatsPanel } from "@/components/EntityStatsPanel";
import { getNonce } from "@/lib/csp-nonce";
import { shouldBlockTaxonomy } from "@/lib/taxonomy-guard";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// force-dynamic because this page awaits searchParams (sp.page, sp.sort)
// for pagination and sort filtering. Next.js 16 makes searchParams a Promise
// and awaiting it opts into dynamic rendering, incompatible with ISR.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { tag } = await params;
  if (isBannedTag(tag)) {
    return {
      title: "Not Found | iku.gg",
      robots: { index: false, follow: false },
    };
  }
  const sp = await searchParams;
  const label = tag.replace(/_/g, " ");
  const titleCased = label.replace(/\b\w/g, (c) => c.toUpperCase());
  const page = parseInt(typeof sp.page === "string" ? sp.page : "1") || 1;
  const sort = typeof sp.sort === "string" ? sp.sort : "score";

  const base = `https://iku.gg/tag/${tag}`;
  const canonical = page > 1 ? `${base}?sort=${sort}&page=${page}` : base;

  // rel prev/next for pagination SEO
  const prev = page > 1 ? `${base}?sort=${sort}&page=${page - 1}` : undefined;
  const next = `${base}?sort=${sort}&page=${page + 1}`;

  // Pull precomputed count. Returns 0 on cache miss — we then fall back to
  // a no-count copy so the title still reads naturally.
  // Desktop CTR 0.6% → 3-5% target: the old title repeated the keyword twice
  // ("Anal Hentai Videos - Best Anal Anime Porn") which looks like spammy SEO
  // in a SERP. New format leads with a specific count (trust signal), avoids
  // keyword repetition, and fits inside Google's 60-char desktop cutoff.
  let count = 0;
  try {
    count = await countVideos({ tags: tag, requireThumbnail: true });
  } catch {
    /* fall through to no-count copy */
  }
  const countStr = count > 0 ? count.toLocaleString("en-US") : "";

  const pageTitle = (() => {
    if (page > 1) return `${titleCased} Hentai — Page ${page} | iku.gg`;
    if (count > 0)
      return `${titleCased} Hentai — ${countStr} Free HD Clips | iku.gg`;
    return `${titleCased} Hentai — Watch Free HD Clips | iku.gg`;
  })();

  const pageDescription =
    count > 0
      ? `Stream ${countStr} free ${label} hentai clips in HD. Animated videos updated daily, no sign-up. Search by character, series, or tag on iku.gg.`
      : `Stream free ${label} hentai clips in HD. Animated videos updated daily, no sign-up. Search by character, series, or tag on iku.gg.`;

  const socialTitle =
    count > 0
      ? `${titleCased} Hentai — ${countStr} Free Clips`
      : `${titleCased} Hentai — Free HD Clips`;

  return {
    title: pageTitle,
    description: pageDescription,
    other: { rating: "adult" },
    alternates: {
      canonical,
      ...(prev || next
        ? {
            types: {
              ...(prev ? { prev: prev } : {}),
              ...(next ? { next: next } : {}),
            },
          }
        : {}),
    },
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
          alt: `${titleCased} Hentai on iku.gg`,
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
  const { tag } = await params;
  if (isBannedTag(tag)) notFound();
  const sp = await searchParams;
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";

  const currentPage = Math.max(1, parseInt(pageParam));
  const label = tag.replace(/_/g, " ");
  const titleCased = label.replace(/\b\w/g, (c) => c.toUpperCase());
  const order = parseSort(sortParam, "score");

  const [{ data: videos, hasMore }, totalCount, entitySeo] = await Promise.all([
    getVideos({
      tags: tag,
      page: currentPage,
      limit: 20,
      order,
      requireThumbnail: true,
    }),
    countVideos({ tags: tag, requireThumbnail: true }),
    getEntitySeo("tag", tag),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  const relatedTags = RELATED_TAGS.filter((t) => t !== tag);

  const tagJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${titleCased} Hentai Videos`,
    description: `Stream free ${label} hentai videos on iku.gg.`,
    url: `https://iku.gg/tag/${tag}`,
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
        name: "Tags",
        item: "https://iku.gg/tags",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: titleCased,
        item: `https://iku.gg/tag/${tag}`,
      },
    ],
  };

  return (
    <div className="shell-content">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(tagJsonLd).replace(/</g, "\\u003c"),
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
          {/* ── Tag hero (compact, above fold on desktop 1440x900) ─── */}
          <div className="tag-hero tag-hero--compact">
            <p className="tag-hero__label">Hentai Tag</p>
            <h1 className="tag-hero__title">{titleCased} Hentai Videos</h1>

            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                <strong>{totalCount.toLocaleString()}</strong> videos
              </span>
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong> of {totalPages}
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
          <nav className="sort-tabs" aria-label="Sort videos">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/tag/${tag}?sort=${opt.value}&page=1`}
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
                interleave={buildGridInterleave("tag")}
              />

              {/* AI bottom — Candy.AI after the grid, before pagination. */}
              <div style={{ margin: "24px auto" }}>
                <AdRotationBanner slug="candy-ai" surface="tag-bottom" />
              </div>

              {/* Soulkyn vertical 4:5 — mobile-first format, paired with
                  the 300x250 above. Direct affiliate (35%/15% recurring). */}
              <div style={{ margin: "24px auto 32px" }}>
                <SoulkynVerticalAd surface="tag-bottom-vertical" />
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

          {/* ── SEO intro (moved below grid so cards are above fold) ── */}
          <section
            className="tag-hero__intro-section"
            style={{ maxWidth: "760px", marginTop: "32px" }}
          >
            {entitySeo ? (
              entitySeo.intro.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    marginBottom: "12px",
                  }}
                >
                  {para}
                </p>
              ))
            ) : (
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "13px",
                  lineHeight: "1.7",
                }}
              >
                Watch <strong>{titleCased.toLowerCase()} hentai</strong> videos
                on iku.gg — the largest free collection of{" "}
                {titleCased.toLowerCase()} animated porn, 3D hentai, SFM clips
                and fan animations. Every {titleCased.toLowerCase()} video is
                streamable instantly with no signup required. Browse by score,
                newest, or most favorited, and find related{" "}
                <Link href="/tags" style={{ color: "var(--color-accent)" }}>
                  tags
                </Link>
                ,{" "}
                <Link
                  href="/character"
                  style={{ color: "var(--color-accent)" }}
                >
                  characters
                </Link>
                , and{" "}
                <Link href="/series" style={{ color: "var(--color-accent)" }}>
                  series/games
                </Link>{" "}
                below. Prefer long-form 2D episodes? Check our{" "}
                <Link href="/hentai" style={{ color: "var(--color-accent)" }}>
                  hentai catalogue
                </Link>
                , or swipe the{" "}
                <Link href="/feed" style={{ color: "var(--color-accent)" }}>
                  Shorts feed
                </Link>{" "}
                for quick clips.
              </p>
            )}
          </section>

          {entitySeo?.meta && entitySeo.meta.total ? (
            <section className="page-section">
              <EntityStatsPanel meta={entitySeo.meta} type="tag" />
            </section>
          ) : null}

          {/* FAQ — from entity_seo (Google FAQPage rich result eligible). */}
          {entitySeo && entitySeo.faq.length > 0 && (
            <section
              className="watch-faq"
              style={{ maxWidth: "760px", marginTop: "32px" }}
            >
              <h2 className="watch-faq__heading">Frequently asked questions</h2>
              {entitySeo.faq.map((item, i) => (
                <details key={i} className="watch-faq__item">
                  <summary className="watch-faq__q">{item.q}</summary>
                  <div className="watch-faq__a">{item.a}</div>
                </details>
              ))}
            </section>
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
                <span className="tag-crosslink-card__title">
                  What Does {titleCased} Mean?
                </span>
                <span className="tag-crosslink-card__cta">
                  Read definition →
                </span>
              </Link>
              <Link
                href="/blog/understanding-hentai-tags"
                className="tag-crosslink-card"
              >
                <span className="tag-crosslink-card__label">Guide</span>
                <span className="tag-crosslink-card__title">
                  Understanding Hentai Tags
                </span>
                <span className="tag-crosslink-card__cta">Read guide →</span>
              </Link>
              <Link href="/blog/what-is-hentai" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Blog</span>
                <span className="tag-crosslink-card__title">
                  What is Hentai?
                </span>
                <span className="tag-crosslink-card__cta">Read article →</span>
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
