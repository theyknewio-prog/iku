import Link from "next/link";
import type { Metadata } from "next";
import { GLOSSARY, getTermsByLetter } from "@/data/glossary";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";

export const metadata: Metadata = {
  title: "Hentai Glossary — 20+ Terms Explained | iku.gg",
  description:
    "Complete hentai glossary with 20+ terms explained. Understand ecchi, NTR, ahegao, vanilla, futanari, and every tag you see on iku.gg.",
  alternates: { canonical: "https://iku.gg/glossary" },
  robots: { index: true, follow: true },
};

export const revalidate = 86400;

export default function GlossaryPage() {
  const byLetter = getTermsByLetter();
  const letters = Object.keys(byLetter).sort();

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* Hero */}
          <div className="glossary-hero">
            <p className="tag-hero__label">Reference</p>
            <h1 className="tag-hero__title">Hentai Glossary</h1>
            <p className="glossary-hero__sub">
              {GLOSSARY.length}+ terms explained — genres, archetypes, tags, and
              culture. Everything you need to understand hentai.
            </p>
            {/* Cocon sémantique */}
            <div className="glossary-hero__links">
              <Link href="/blog" className="btn btn-ghost btn-sm">
                Blog &amp; Guides
              </Link>
              <Link href="/tags" className="btn btn-ghost btn-sm">
                Browse Tags
              </Link>
            </div>
          </div>

          {/* Listing ad — HilltopAds 300x250 below hero */}
          <div style={{ margin: "16px auto 24px" }}>
            <HilltopAdsBanner />
          </div>

          {/* Alphabet nav */}
          <nav className="glossary-alpha-nav" aria-label="Alphabet navigation">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="glossary-alpha-link"
              >
                {letter}
              </a>
            ))}
          </nav>

          {/* Terms grouped by letter */}
          <div className="glossary-sections">
            {letters.map((letter) => (
              <section
                key={letter}
                id={`letter-${letter}`}
                className="glossary-letter-section"
              >
                <h2 className="glossary-letter-heading">{letter}</h2>
                <div className="glossary-grid">
                  {byLetter[letter].map((term) => (
                    <Link
                      key={term.slug}
                      href={`/glossary/${term.slug}`}
                      className="glossary-card"
                    >
                      <div className="glossary-card__category">
                        {term.category}
                      </div>
                      <h3 className="glossary-card__title">{term.title}</h3>
                      <p className="glossary-card__excerpt">
                        {term.definition.slice(0, 100)}…
                      </p>
                      <span className="glossary-card__cta">Read more →</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Bottom cross-links */}
          <section className="page-section" style={{ marginTop: "48px" }}>
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Learn More
              </h2>
            </div>
            <div className="glossary-footer-links">
              <Link
                href="/blog/what-is-hentai"
                className="glossary-footer-link"
              >
                What is Hentai? Complete Guide
              </Link>
              <Link
                href="/blog/understanding-hentai-tags"
                className="glossary-footer-link"
              >
                Understanding Hentai Tags
              </Link>
              <Link href="/tags" className="glossary-footer-link">
                Browse All Tags on iku.gg
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
