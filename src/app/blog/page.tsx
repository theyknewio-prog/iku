import Link from "next/link";
import type { Metadata } from "next";
import { BLOG_ARTICLES } from "@/data/blog";

export const metadata: Metadata = {
  title: "Hentai Blog — Guides, History & Culture | iku.gg",
  description:
    "The iku.gg blog: guides on hentai genres, tags, studios, characters, and history. Everything from beginners to enthusiasts.",
  alternates: { canonical: "https://iku.gg/blog" },
  robots: { index: true, follow: true },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const [featured, ...rest] = BLOG_ARTICLES;

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">

          {/* Hero */}
          <div className="glossary-hero">
            <p className="tag-hero__label">Blog</p>
            <h1 className="tag-hero__title">Hentai Guides &amp; Culture</h1>
            <p className="glossary-hero__sub">
              Guides, rankings, history, and deep dives — everything about hentai, written for fans.
            </p>
          </div>

          {/* Featured article */}
          <Link href={`/blog/${featured.slug}`} className="blog-featured">
            <div className="blog-featured__meta">
              <span className="blog-featured__badge">Featured</span>
              <span className="blog-featured__date">{formatDate(featured.publishedAt)}</span>
              <span className="blog-featured__read">{featured.readingTime} min read</span>
            </div>
            <h2 className="blog-featured__title">{featured.title}</h2>
            <p className="blog-featured__excerpt">{featured.excerpt}</p>
            <div className="blog-featured__tags">
              {featured.tags.slice(0, 4).map((t) => (
                <span key={t} className="blog-tag-pill">{t}</span>
              ))}
            </div>
            <span className="blog-featured__cta">Read article →</span>
          </Link>

          {/* Article grid */}
          <div className="blog-grid">
            {rest.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`} className="blog-card">
                <div className="blog-card__meta">
                  <span className="blog-card__date">{formatDate(article.publishedAt)}</span>
                  <span className="blog-card__read">{article.readingTime} min read</span>
                </div>
                <h3 className="blog-card__title">{article.title}</h3>
                <p className="blog-card__excerpt">{article.excerpt}</p>
                <div className="blog-card__tags">
                  {article.tags.slice(0, 3).map((t) => (
                    <span key={t} className="blog-tag-pill">{t}</span>
                  ))}
                </div>
                <span className="blog-card__cta">Read →</span>
              </Link>
            ))}
          </div>

          {/* Cross-link to glossary */}
          <section className="page-section" style={{ marginTop: "48px" }}>
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                New to hentai?
              </h2>
            </div>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Learn every term and genre in our complete reference guide.
            </p>
            <Link href="/glossary" className="btn btn-secondary">
              Browse the Glossary →
            </Link>
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
