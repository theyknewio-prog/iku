import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BLOG_ARTICLES,
  getArticleBySlug,
  getRelatedArticles,
} from "@/data/blog";
import { GLOSSARY } from "@/data/glossary";
import { getInternalLinksForArticle } from "@/data/blog-internal-links";
import { getNonce } from "@/lib/csp-nonce";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article not found | iku.gg" };

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    alternates: { canonical: `https://iku.gg/blog/${article.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: article.seoTitle,
      description: article.seoDescription,
      url: `https://iku.gg/blog/${article.slug}`,
      siteName: "iku.gg",
      type: "article",
      publishedTime: article.publishedAt,
      images: [
        {
          url: "https://iku.gg/og-default.png",
          width: 1200,
          height: 630,
          alt: article.seoTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.seoDescription,
      images: ["https://iku.gg/og-default.png"],
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const nonce = await getNonce();
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const relatedArticles = getRelatedArticles(article);
  const glossaryTerms = GLOSSARY.filter((t) =>
    article.glossaryLinks.includes(t.slug),
  );

  /* Breadcrumbs */
  const breadcrumbs = [
    { name: "Home", url: "https://iku.gg/" },
    { name: "Blog", url: "https://iku.gg/blog" },
    { name: article.title, url: `https://iku.gg/blog/${article.slug}` },
  ];

  /* Article schema */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription,
    datePublished: article.publishedAt,
    author: {
      "@type": "Organization",
      name: "iku.gg",
      url: "https://iku.gg",
    },
    publisher: {
      "@type": "Organization",
      name: "iku.gg",
      url: "https://iku.gg",
    },
    url: `https://iku.gg/blog/${article.slug}`,
    keywords: article.tags.join(", "),
  };

  /* BreadcrumbList schema */
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
        }}
      />

      <div className="shell-content">
        <main>
          <div className="page-container">
            <div className="blog-post-layout">
              {/* Main column */}
              <article className="blog-post-main">
                {/* Breadcrumbs */}
                <nav className="glossary-breadcrumbs" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={crumb.url}>
                      {i > 0 && (
                        <span className="glossary-breadcrumbs__sep" aria-hidden>
                          {" "}
                          /{" "}
                        </span>
                      )}
                      {i < breadcrumbs.length - 1 ? (
                        <Link
                          href={crumb.url.replace("https://iku.gg", "")}
                          className="glossary-breadcrumbs__link"
                        >
                          {crumb.name}
                        </Link>
                      ) : (
                        <span
                          className="glossary-breadcrumbs__current"
                          aria-current="page"
                        >
                          {article.title.length > 40
                            ? article.title.slice(0, 40) + "…"
                            : article.title}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>

                {/* Article header */}
                <header className="blog-post-header">
                  <div className="blog-post-meta">
                    <time dateTime={article.publishedAt}>
                      {formatDate(article.publishedAt)}
                    </time>
                    <span className="blog-post-meta__dot">·</span>
                    <span>{article.readingTime} min read</span>
                  </div>
                  <h1 className="blog-post-title">{article.title}</h1>
                  <p className="blog-post-excerpt">{article.excerpt}</p>
                  <div className="blog-post-tags">
                    {article.tags.map((t) => (
                      <span key={t} className="blog-tag-pill">
                        {t}
                      </span>
                    ))}
                  </div>
                </header>

                {/* Article body — content is from static data files (src/data/blog.ts).
                   If this ever becomes dynamic/user-generated, add a proper HTML
                   sanitizer like DOMPurify. The basic strip below is a safety net. */}
                <div
                  className="blog-post-body"
                  dangerouslySetInnerHTML={{
                    __html: article.content
                      .replace(
                        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                        "",
                      )
                      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
                      .replace(/javascript:/gi, ""),
                  }}
                />

                {/* Article-body ad — HilltopAds 300x250 between body
                    and the cross-link sections. Reader is mid-engagement
                    here, ad-blindness lower than top-of-page. */}
                <div style={{ margin: "32px auto" }}>
                  <HilltopAdsBanner />
                </div>

                {/* AI affiliate ad — Candy-AI 300x250, second mid-article slot */}
                <div style={{ margin: "16px auto 8px" }}>
                  <AdRotationBanner
                    slug="candy-ai"
                    surface="blog-article-mid"
                  />
                </div>

                {/* Soulkyn vertical 4:5 — third brand mid-article. */}
                <div style={{ margin: "8px auto 32px" }}>
                  <SoulkynVerticalAd surface="blog-article-vertical" />
                </div>

                {/* Glossary cross-links */}
                {glossaryTerms.length > 0 && (
                  <section className="blog-glossary-links">
                    <h2 className="glossary-related-heading">
                      Terms in This Article
                    </h2>
                    <div className="glossary-grid">
                      {glossaryTerms.map((term) => (
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
                            {term.definition.slice(0, 80)}…
                          </p>
                          <span className="glossary-card__cta">
                            Definition →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Dynamic internal links (generated by seo-autopilot) */}
                {(() => {
                  const internalLinks = getInternalLinksForArticle(slug);
                  if (!internalLinks || internalLinks.linksToAdd.length === 0)
                    return null;
                  return (
                    <section
                      className="blog-glossary-links"
                      style={{ marginTop: "32px" }}
                    >
                      <h2 className="glossary-related-heading">
                        Related Content on iku.gg
                      </h2>
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        {internalLinks.linksToAdd.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className="tag-pill tag-pill--dark"
                              style={{
                                display: "inline-block",
                                fontSize: "var(--text-sm)",
                              }}
                            >
                              {link.text}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })()}

                <div style={{ marginTop: "32px" }}>
                  <Link href="/blog" className="btn btn-ghost btn-sm">
                    ← Back to Blog
                  </Link>
                </div>
              </article>

              {/* Sidebar */}
              {relatedArticles.length > 0 && (
                <aside className="blog-post-sidebar">
                  <h2 className="glossary-related-heading">Related Articles</h2>
                  <div className="blog-sidebar-list">
                    {relatedArticles.map((rel) => (
                      <Link
                        key={rel.slug}
                        href={`/blog/${rel.slug}`}
                        className="blog-sidebar-item"
                      >
                        <span className="blog-sidebar-item__title">
                          {rel.title}
                        </span>
                        <span className="blog-sidebar-item__read">
                          {rel.readingTime} min read
                        </span>
                      </Link>
                    ))}
                  </div>

                  <div style={{ marginTop: "32px" }}>
                    <h2 className="glossary-related-heading">Quick Links</h2>
                    <div className="blog-sidebar-list">
                      <Link href="/glossary" className="blog-sidebar-item">
                        <span className="blog-sidebar-item__title">
                          Hentai Glossary
                        </span>
                      </Link>
                      <Link href="/trending" className="blog-sidebar-item">
                        <span className="blog-sidebar-item__title">
                          Trending Videos
                        </span>
                      </Link>
                      <Link href="/tags" className="blog-sidebar-item">
                        <span className="blog-sidebar-item__title">
                          Browse All Tags
                        </span>
                      </Link>
                    </div>
                  </div>
                </aside>
              )}
            </div>
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
    </>
  );
}
