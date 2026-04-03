import Link from "next/link";
import { CHARACTERS } from "@/data/characters";
import { SERIES } from "@/data/series";
import type { Metadata } from "next";

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
  },
};

export const revalidate = 86400;

// Group characters by series for display
function groupBySeries() {
  const groups: { series: (typeof SERIES)[number]; chars: (typeof CHARACTERS)[number][] }[] = [];
  for (const s of SERIES) {
    const chars = CHARACTERS.filter((c) => c.series === s.slug);
    if (chars.length > 0) {
      groups.push({ series: s, chars });
    }
  }
  return groups;
}

export default function CharactersPage() {
  const groups = groupBySeries();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://iku.gg" },
      { "@type": "ListItem", position: 2, name: "Characters", item: "https://iku.gg/character" },
    ],
  };

  return (
    <div className="shell-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Character Directory</p>
            <h1 className="tag-hero__title">Hentai Characters</h1>
            <p style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              marginTop: "8px",
            }}>
              {CHARACTERS.length} characters from {SERIES.length} anime series
            </p>
          </div>

          {/* ── All characters by series ─────────────────────── */}
          {groups.map(({ series, chars }) => (
            <section key={series.slug} className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  <Link href={`/series/${series.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {series.name}
                  </Link>
                </h2>
              </div>
              <div className="tag-grid">
                {chars.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/character/${c.slug}`}
                    className="tag-pill tag-pill--dark"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
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
                <span className="tag-crosslink-card__title">All Hentai Series</span>
                <span className="tag-crosslink-card__cta">Browse series →</span>
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
