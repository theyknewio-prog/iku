import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GLOSSARY, getTermBySlug, getRelatedTerms } from "@/data/glossary";
import { BLOG_ARTICLES } from "@/data/blog";
import { getNonce } from "@/lib/csp-nonce";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";

interface TermPageProps {
  params: Promise<{ term: string }>;
}

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({
  params,
}: TermPageProps): Promise<Metadata> {
  const { term: slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return { title: "Term not found | iku.gg" };

  return {
    title: term.seoTitle,
    description: term.seoDescription,
    alternates: { canonical: `https://iku.gg/glossary/${term.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: term.seoTitle,
      description: term.seoDescription,
      url: `https://iku.gg/glossary/${term.slug}`,
      siteName: "iku.gg",
      type: "article",
    },
  };
}

export default async function TermPage({ params }: TermPageProps) {
  const nonce = await getNonce();
  const { term: slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) notFound();

  const relatedTerms = getRelatedTerms(term);
  const relatedArticles = BLOG_ARTICLES.filter((a) =>
    term.relatedArticles.includes(a.slug),
  );

  /* Breadcrumbs */
  const breadcrumbs = [
    { name: "Home", url: "https://iku.gg/" },
    { name: "Glossary", url: "https://iku.gg/glossary" },
    { name: term.title, url: `https://iku.gg/glossary/${term.slug}` },
  ];

  /* FAQ schema — one Q&A: what is [term]? */
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is ${term.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: term.definition,
        },
      },
      {
        "@type": "Question",
        name: `What category does ${term.title} belong to?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${term.title} is classified as a ${term.category} term in hentai culture.`,
        },
      },
    ],
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
          __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c"),
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
                      {crumb.name}
                    </span>
                  )}
                </span>
              ))}
            </nav>

            {/* Term header */}
            <div className="glossary-term-header">
              <span className="glossary-category-badge">{term.category}</span>
              <h1 className="glossary-term-title">What is {term.title}?</h1>
            </div>

            {/* Definition */}
            <div className="glossary-term-body">
              <p className="glossary-term-definition">{term.definition}</p>
            </div>

            {/* Term-body ad — HilltopAds 300x250 between definition and
                cross-link sections. */}
            <div style={{ margin: "32px auto" }}>
              <HilltopAdsBanner />
            </div>

            {/* Related tags */}
            {term.relatedTags.length > 0 && (
              <section className="glossary-related-section">
                <h2 className="glossary-related-heading">
                  Browse {term.title} Videos
                </h2>
                <div className="glossary-tag-pills">
                  {term.relatedTags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tag/${tag}`}
                      className="tag-pill tag-pill--dark"
                    >
                      {tag.replace(/_/g, " ")}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related glossary terms */}
            {relatedTerms.length > 0 && (
              <section className="glossary-related-section">
                <h2 className="glossary-related-heading">Related Terms</h2>
                <div className="glossary-grid">
                  {relatedTerms.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/glossary/${related.slug}`}
                      className="glossary-card"
                    >
                      <div className="glossary-card__category">
                        {related.category}
                      </div>
                      <h3 className="glossary-card__title">{related.title}</h3>
                      <p className="glossary-card__excerpt">
                        {related.definition.slice(0, 100)}…
                      </p>
                      <span className="glossary-card__cta">Read more →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related blog articles */}
            {relatedArticles.length > 0 && (
              <section className="glossary-related-section">
                <h2 className="glossary-related-heading">Related Guides</h2>
                <div className="blog-grid">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/blog/${article.slug}`}
                      className="blog-card"
                    >
                      <div className="blog-card__meta">
                        <span className="blog-card__read">
                          {article.readingTime} min read
                        </span>
                      </div>
                      <h3 className="blog-card__title">{article.title}</h3>
                      <p className="blog-card__excerpt">{article.excerpt}</p>
                      <span className="blog-card__cta">Read →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Back to glossary */}
            <div style={{ marginTop: "40px" }}>
              <Link href="/glossary" className="btn btn-ghost btn-sm">
                ← Back to Glossary
              </Link>
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
