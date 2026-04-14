import Link from "next/link";
import { getPopularTags, getPopularCharactersPg } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hentai Tags — Browse All Categories | iku.gg",
  description:
    "Browse all hentai video tags on iku.gg. Find your favorite animated hentai categories, characters, and styles.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Hentai Tags — Browse All Categories | iku.gg",
    description:
      "Explore all hentai tags and categories on iku.gg. Stream free animated hentai by tag.",
    siteName: "iku.gg",
    type: "website",
    images: [{ url: "https://iku.gg/og-default.png", width: 1200, height: 630, alt: "iku.gg" }],
  },
};

export const revalidate = 86400;
export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const [popularTags, popularCharacters] = await Promise.all([
    getPopularTags(60),
    getPopularCharactersPg(40),
  ]);

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">All Categories</p>
            <h1 className="tag-hero__title">Browse Hentai Tags</h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
              }}
            >
              {popularTags.length} popular tags to explore
            </p>
          </div>

          {/* ── General tags ──────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Popular Hentai Tags
              </h2>
            </div>
            <div className="tag-grid">
              {popularTags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tag/${tag.name}`}
                  className="tag-pill tag-pill--dark"
                >
                  {tag.name.replace(/_/g, " ")}
                  <span className="tag-pill__count">
                    {tag.count.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <div className="divider" />

          {/* ── Character tags ────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Popular Hentai Characters
              </h2>
            </div>
            <div className="tag-grid">
              {popularCharacters.map((char) => (
                <Link
                  key={char.name}
                  href={`/tag/${char.name}`}
                  className="tag-pill tag-pill--dark"
                >
                  {char.name.replace(/_/g, " ")}
                  <span className="tag-pill__count">
                    {char.count.toLocaleString()}
                  </span>
                </Link>
              ))}
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
