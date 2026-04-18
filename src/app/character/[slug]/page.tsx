import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BlacklistFilter } from "@/components/BlacklistFilter";
import { Pagination } from "@/components/Pagination";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { getVideos, countVideos } from "@/lib/content";
import { getEntitySeo } from "@/lib/entity-seo";
import { getNonce } from "@/lib/csp-nonce";
import { HentaiProsBanner } from "@/components/HentaiProsBanner";
import { ListingAdBlock } from "@/components/ListingAdBlock";
import {
  CHARACTERS,
  getCharacterBySlug,
  type Character,
} from "@/data/characters";
import { getCharacterSEO } from "@/data/characters-seo";
import { getSeriesBySlug } from "@/data/series";
import type { Metadata } from "next";

/**
 * Resolve a character slug to a Character object. Falls back to a synthesized
 * "virtual character" for Danbooru tag names that aren't in the static
 * CHARACTERS dataset. The homepage links directly to popular character tag
 * names (e.g. /character/hatsune_miku) which are not in CHARACTERS — without
 * this fallback, those links 404.
 */
function resolveCharacter(slug: string): Character | null {
  const existing = getCharacterBySlug(slug);
  if (existing) return existing;

  // Reject obviously invalid slugs
  if (!slug || slug.length < 2 || slug.length > 80) return null;
  if (!/^[a-z0-9_\-()]+$/i.test(slug)) return null;

  const rawName = slug.replace(/_/g, " ").replace(/-/g, " ");
  const displayName = rawName.replace(/\b\w/g, (c) => c.toUpperCase());
  const tag = slug.replace(/-/g, "_");

  return {
    slug,
    name: displayName,
    series: "",
    seriesName: "",
    description: `${displayName} is a popular anime character featured in hundreds of fan animations. Browse the best free ${displayName} hentai videos on iku.gg, updated daily from top fan artists and animators across the booru ecosystem.`,
    tags: [tag],
    relatedCharacters: [],
    seoTitle: `${displayName} Hentai — Best Videos & Animations | iku.gg`,
    seoDescription: `Watch free ${displayName} hentai videos on iku.gg. Stream top-rated animated ${displayName} porn featuring the most popular scenes and fan art.`,
  };
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// force-dynamic because this page awaits searchParams for pagination/sort.
// generateStaticParams was removed — inert under force-dynamic.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const character = resolveCharacter(slug);
  if (!character) return { title: "Character Not Found | iku.gg" };

  const page = parseInt(typeof sp.page === "string" ? sp.page : "1") || 1;
  const canonical =
    page > 1
      ? `https://iku.gg/character/${slug}?page=${page}`
      : `https://iku.gg/character/${slug}`;

  return {
    title:
      page > 1
        ? `${character.name} Hentai — Page ${page} | iku.gg`
        : character.seoTitle,
    description: character.seoDescription,
    other: { rating: "adult" },
    alternates: { canonical },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `${character.name} Hentai Videos | iku.gg`,
      description: character.seoDescription,
      siteName: "iku.gg",
      type: "website",
      images: [
        {
          url: "https://iku.gg/og-default.png",
          width: 1200,
          height: 630,
          alt: `${character.name} Hentai on iku.gg`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${character.name} Hentai Videos | iku.gg`,
      description: character.seoDescription,
      images: ["https://iku.gg/og-default.png"],
    },
  };
}

const SORT_OPTIONS = [
  { value: "score", label: "Top Rated" },
  { value: "date", label: "Newest" },
  { value: "duration", label: "Longest" },
  { value: "favcount", label: "Most Saved" },
] as const;

export default async function CharacterPage({ params, searchParams }: Props) {
  const nonce = await getNonce();
  const { slug } = await params;
  const sp = await searchParams;
  const character = resolveCharacter(slug);
  if (!character) notFound();

  const series = getSeriesBySlug(character.series);
  const pageParam = typeof sp.page === "string" ? sp.page : "1";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "score";
  const currentPage = Math.max(1, parseInt(pageParam));
  const order =
    sortParam === "date" ||
    sortParam === "favcount" ||
    sortParam === "score" ||
    sortParam === "duration"
      ? sortParam
      : "score";

  const [{ data: videos, hasMore }, totalCount, entitySeo] = await Promise.all([
    getVideos({
      tags: character.tags[0],
      page: currentPage,
      limit: 20,
      order,
      requireThumbnail: true,
    }),
    countVideos({ tags: character.tags[0], requireThumbnail: true }),
    getEntitySeo("character", character.tags[0]),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

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
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://iku.gg",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Characters",
        item: "https://iku.gg/character",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: character.name,
        item: `https://iku.gg/character/${slug}`,
      },
    ],
  };

  // FAQPage JSON-LD from character SEO enrichment
  const charSEO = getCharacterSEO(slug);
  const faqJsonLd = charSEO?.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: charSEO.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  return (
    <div className="shell-content">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <main>
        <div className="page-container">
          <ListingAdBlock variant="top" />

          {/* ── Character hero ──────────────────────────────────── */}
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
                href="/character"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Characters
              </Link>
              {" / "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                {character.name}
              </span>
            </nav>
            <p className="tag-hero__label">Hentai Character</p>
            <h1 className="tag-hero__title">
              {character.name} Hentai — Best Videos &amp; Fan Animation
            </h1>

            {series && (
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-sm)",
                  marginTop: "4px",
                }}
              >
                From{" "}
                <Link
                  href={`/series/${series.slug}`}
                  style={{
                    color: "var(--color-accent)",
                    textDecoration: "underline",
                  }}
                >
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
                <strong>
                  {SORT_OPTIONS.find((s) => s.value === order)?.label}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Description (entity_seo PG-backed → falls back to characters-seo.ts → static) ── */}
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
                {(() => {
                  const seoData = getCharacterSEO(slug);
                  return seoData?.seoDescription || character.description;
                })()}
              </p>
            )}
            {/* FAQ — entity_seo first, fallback to characters-seo.ts */}
            {entitySeo && entitySeo.faq.length > 0 ? (
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
            ) : (
              (() => {
                const seoData = getCharacterSEO(slug);
                if (!seoData?.faq?.length) return null;
                return (
                  <div className="watch-faq" style={{ marginTop: "24px" }}>
                    <h2 className="watch-faq__heading">
                      Frequently Asked Questions
                    </h2>
                    {seoData.faq.map((item, i) => (
                      <details key={i} className="watch-faq__item">
                        <summary className="watch-faq__question">
                          {item.question}
                        </summary>
                        <p className="watch-faq__answer">{item.answer}</p>
                      </details>
                    ))}
                  </div>
                );
              })()
            )}
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
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
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
              <ListingAdBlock variant="mid" />
              <BlacklistFilter videos={videos} />
              <ListingAdBlock variant="bottom" />
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
                {relatedChars.map(
                  (rc) =>
                    rc && (
                      <Link
                        key={rc.slug}
                        href={`/character/${rc.slug}`}
                        className="tag-pill tag-pill--dark"
                      >
                        {rc.name}
                        <span className="tag-pill__count">{rc.seriesName}</span>
                      </Link>
                    ),
                )}
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
                <Link
                  href={`/series/${series.slug}`}
                  className="tag-crosslink-card"
                >
                  <span className="tag-crosslink-card__label">Series</span>
                  <span className="tag-crosslink-card__title">
                    {series.name} Hentai
                  </span>
                  <span className="tag-crosslink-card__cta">
                    View all videos →
                  </span>
                </Link>
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
                  <span className="tag-crosslink-card__cta">
                    Browse series →
                  </span>
                </Link>
              </div>
            </section>
          )}
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
