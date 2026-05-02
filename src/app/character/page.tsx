import React from "react";
import Link from "next/link";
import Image from "next/image";
import { CHARACTERS } from "@/data/characters";
import { SERIES } from "@/data/series";
import { getThumbnailsForTags } from "@/lib/content";
import { getNonce } from "@/lib/csp-nonce";
import type { Metadata } from "next";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";

export const metadata: Metadata = {
  title: "Hentai Characters — Browse All Anime Characters | iku.gg",
  description:
    "Browse all 50 hentai characters on iku.gg. Find your favorite anime characters from Naruto, One Piece, Dragon Ball, Genshin Impact, and more.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg/character" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Hentai Characters — Browse All Anime Characters | iku.gg",
    description:
      "Explore all hentai characters on iku.gg. Stream free animated hentai by character.",
    siteName: "iku.gg",
    type: "website",
    images: [
      {
        url: "https://iku.gg/og-default.png",
        width: 1200,
        height: 630,
        alt: "iku.gg",
      },
    ],
  },
};

// PG-backed thumbnails aren't available at build time — force dynamic + ISR.
export const revalidate = 86400;
export const dynamic = "force-dynamic";

// Group characters by series for display
function groupBySeries() {
  const groups: {
    series: (typeof SERIES)[number];
    chars: (typeof CHARACTERS)[number][];
  }[] = [];
  for (const s of SERIES) {
    const chars = CHARACTERS.filter((c) => c.series === s.slug);
    if (chars.length > 0) {
      groups.push({ series: s, chars });
    }
  }
  return groups;
}

/** Return a cute emoji fallback when no thumbnail is available yet. */
function fallbackEmoji(name: string): string {
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  const pool = ["🌸", "⚡", "🔥", "💖", "✨", "🌙", "🦋", "🍓", "🎀", "⭐"];
  return pool[code % pool.length];
}

export default async function CharactersPage() {
  const nonce = await getNonce();
  const groups = groupBySeries();

  // Batch-fetch real thumbnails for every character using their primary Danbooru tag.
  // getThumbnailsForTags is memoized (1h TTL) so this is effectively free on warm cache.
  const allTags = CHARACTERS.map((c) => c.tags[0]).filter(Boolean);
  const thumbnails = await getThumbnailsForTags(allTags);

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
    ],
  };

  return (
    <div className="shell-content">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Character Directory</p>
            <h1 className="tag-hero__title">Hentai Characters</h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
              }}
            >
              {CHARACTERS.length} characters from {SERIES.length} anime series
            </p>
          </div>

          {/* Inline ad — HilltopAds 300x250 */}
          <div style={{ margin: "16px auto 24px" }}>
            <HilltopAdsBanner />
          </div>

          {/* ── All characters by series ─────────────────────── */}
          {groups.map(({ series, chars }) => (
            <React.Fragment key={series.slug}>
              <section className="page-section">
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="section-title__bar" aria-hidden />
                    <Link
                      href={`/series/${series.slug}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {series.name}
                    </Link>
                  </h2>
                </div>
                <div className="index-char-grid">
                  {chars.map((c) => {
                    const thumb = thumbnails[c.tags[0]] || "";
                    return (
                      <Link
                        key={c.slug}
                        href={`/character/${c.slug}`}
                        className="index-char-card"
                      >
                        <div className="index-char-card__avatar">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={c.name}
                              fill
                              sizes="(max-width: 768px) 110px, 130px"
                              className="index-char-card__img"
                              unoptimized
                            />
                          ) : (
                            <span
                              className="index-char-card__fallback"
                              aria-hidden
                            >
                              {fallbackEmoji(c.name)}
                            </span>
                          )}
                        </div>
                        <span className="index-char-card__name">{c.name}</span>
                        <span className="index-char-card__series">
                          {c.seriesName}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </React.Fragment>
          ))}

          {/* ── Cross-links ──────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Explore More
              </h2>
            </div>
            <div className="tag-crosslinks">
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
              <Link href="/trending" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Trending</span>
                <span className="tag-crosslink-card__title">
                  Trending Hentai
                </span>
                <span className="tag-crosslink-card__cta">View trending →</span>
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
