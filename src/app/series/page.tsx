import Link from "next/link";
import Image from "next/image";
import { SERIES } from "@/data/series";
import { getThumbnailsForTags } from "@/lib/content";
import { getNonce } from "@/lib/csp-nonce";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hentai Series — Browse All Anime Series | iku.gg",
  description:
    "Browse all hentai series on iku.gg. Find hentai videos from Naruto, One Piece, Dragon Ball, Genshin Impact, Chainsaw Man, and more anime.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg/series" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Hentai Series — Browse All Anime Series | iku.gg",
    description:
      "Explore all hentai series on iku.gg. Stream free animated hentai by anime series.",
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

export default async function SeriesIndexPage() {
  const nonce = await getNonce();
  // Batch-fetch real poster thumbnails for every series using the primary tag.
  const allTags = SERIES.map((s) => s.tags[0]).filter(Boolean);
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
        name: "Series",
        item: "https://iku.gg/series",
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
            <p className="tag-hero__label">Series Directory</p>
            <h1 className="tag-hero__title">Hentai Series</h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
              }}
            >
              {SERIES.length} anime series to explore
            </p>
          </div>

          {/* ── All series ───────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                All Anime Series
              </h2>
            </div>
            <div className="index-series-grid">
              {SERIES.map((s) => {
                const thumb = thumbnails[s.tags[0]] || "";
                return (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}`}
                    className="index-series-card"
                  >
                    <div className="index-series-card__poster">
                      {thumb && (
                        <Image
                          src={thumb}
                          alt={s.name}
                          fill
                          sizes="(max-width: 768px) 160px, 200px"
                          className="index-series-card__img"
                          unoptimized
                        />
                      )}
                      <span className="index-series-card__name">{s.name}</span>
                    </div>
                    <span className="index-series-card__count">
                      {s.characters.length}{" "}
                      {s.characters.length === 1 ? "character" : "characters"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

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
