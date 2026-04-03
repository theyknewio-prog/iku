import Link from "next/link";
import { SERIES } from "@/data/series";
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
  },
};

export default function SeriesIndexPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://iku.gg" },
      { "@type": "ListItem", position: 2, name: "Series", item: "https://iku.gg/series" },
    ],
  };

  return (
    <div className="shell-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Series Directory</p>
            <h1 className="tag-hero__title">Hentai Series</h1>
            <p style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              marginTop: "8px",
            }}>
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
            <div className="tag-grid">
              {SERIES.map((s) => (
                <Link
                  key={s.slug}
                  href={`/series/${s.slug}`}
                  className="tag-pill tag-pill--dark"
                >
                  {s.name}
                  <span className="tag-pill__count">
                    {s.characters.length} characters
                  </span>
                </Link>
              ))}
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
                <span className="tag-crosslink-card__title">All Hentai Characters</span>
                <span className="tag-crosslink-card__cta">Browse characters →</span>
              </Link>
              <Link href="/tags" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Tags</span>
                <span className="tag-crosslink-card__title">Browse All Tags</span>
                <span className="tag-crosslink-card__cta">View tags →</span>
              </Link>
              <Link href="/trending" className="tag-crosslink-card">
                <span className="tag-crosslink-card__label">Trending</span>
                <span className="tag-crosslink-card__title">Trending Hentai</span>
                <span className="tag-crosslink-card__cta">View trending →</span>
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
