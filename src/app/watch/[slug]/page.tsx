import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { WatchPlayer } from "@/components/WatchPlayer";
import { WatchActions } from "@/components/WatchActions";
import { getPost, getRelatedPosts } from "@/lib/danbooru";
import { getGelbooruPost } from "@/lib/gelbooru";
import { getRule34Post } from "@/lib/rule34";
import { getRule34VideoPost, getRule34VideoPageUrl } from "@/lib/rule34video";
import { getWPHentaiPost, getWPHentaiPageUrl } from "@/lib/wp-hentai";
import { extractIdFromSlug, isGelbooruSlug, isRule34Slug, isRule34VideoSlug, isWPHentaiSlug } from "@/lib/slugify";
import type { Video } from "@/types/video";
import {
  generateVideoDescription,
  generateVideoFAQ,
  generateBreadcrumbs,
} from "@/lib/content-generator";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

interface WatchPageProps {
  params: Promise<{ slug: string }>;
}

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

function fmt(raw: string): string {
  return raw.replace(/_/g, " ");
}

function buildTitle(video: Video): string {
  const character = video.characters[0] ? fmt(video.characters[0]) : "";
  const copyright = video.copyrights[0] ? fmt(video.copyrights[0]) : "";
  if (character && copyright) return `${character} Hentai - ${copyright} | iku.gg`;
  if (character) return `${character} Hentai | iku.gg`;
  if (copyright) return `${copyright} Hentai | iku.gg`;
  // Fallback for rule34video/WP sources: build title from tags (which come from video title)
  const tagTitle = video.tags.slice(0, 5).map(fmt).join(" ");
  if (tagTitle) return `${tagTitle} — Hentai | iku.gg`;
  return `Hentai Video | iku.gg`;
}

function buildDescription(video: Video): string {
  const char = video.characters.slice(0, 3).map(fmt).join(", ");
  const copy = video.copyrights[0] ? fmt(video.copyrights[0]) : "";
  const tagSample = video.tags.slice(0, 6).map(fmt).join(", ");
  const parts: string[] = [];
  if (char) parts.push(`Watch ${char} hentai`);
  else if (tagSample) parts.push(`Watch ${tagSample} hentai`);
  else parts.push("Watch hentai");
  if (copy) parts.push(`from ${copy}`);
  parts.push(`on iku.gg. Free animated hentai video.`);
  if (tagSample && !char) parts.push(`Featuring: ${tagSample}.`);
  parts.push("Stream free hentai online.");
  return parts.join(" ");
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────
   Metadata
───────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: WatchPageProps): Promise<Metadata> {
  const { slug } = await params;

  let video: Video;
  try {
    const id = extractIdFromSlug(slug);
    if (isWPHentaiSlug(slug)) {
      const wv = getWPHentaiPost(id);
      if (!wv) return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = wv;
    } else if (isRule34VideoSlug(slug)) {
      const rv = getRule34VideoPost(id);
      if (!rv) return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = rv;
    } else if (isRule34Slug(slug)) {
      const rv = await getRule34Post(id);
      if (!rv) return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = rv;
    } else if (isGelbooruSlug(slug)) {
      const gv = await getGelbooruPost(id);
      if (!gv) return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = gv;
    } else {
      video = await getPost(id);
    }
  } catch {
    return {
      title: "Hentai Video | iku.gg",
      robots: { index: false },
    };
  }

  const title = buildTitle(video);
  const description = buildDescription(video);
  const canonicalUrl = `https://iku.gg/watch/${video.slug}`;
  const ogImage = video.thumbnail || video.preview;
  const ogVideo = video.url;

  return {
    title,
    description,
    other: {
      rating: "adult",
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "iku.gg",
      type: "video.other",
      images: ogImage
        ? [
            {
              url: ogImage,
              width: video.width || 1280,
              height: video.height || 720,
              alt: title,
            },
          ]
        : [],
      videos: ogVideo
        ? [
            {
              url: ogVideo,
              type: "video/mp4",
              width: video.width || 1280,
              height: video.height || 720,
            },
          ]
        : [],
    },
    twitter: {
      card: "player",
      title,
      description,
      images: ogImage ? [ogImage] : [],
      players: ogVideo
        ? [
            {
              playerUrl: `https://iku.gg/watch/${video.slug}`,
              streamUrl: ogVideo,
              width: video.width || 1280,
              height: video.height || 720,
            },
          ]
        : [],
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;

  let video: Video;
  let resolvePageUrl: string | null = null;
  try {
    const id = extractIdFromSlug(slug);
    if (isWPHentaiSlug(slug)) {
      const wv = getWPHentaiPost(id);
      if (!wv) notFound();
      video = wv;
      resolvePageUrl = getWPHentaiPageUrl(id);
    } else if (isRule34VideoSlug(slug)) {
      const rv = getRule34VideoPost(id);
      if (!rv) notFound();
      video = rv;
      resolvePageUrl = getRule34VideoPageUrl(id);
    } else if (isRule34Slug(slug)) {
      const rv = await getRule34Post(id);
      if (!rv) notFound();
      video = rv;
    } else if (isGelbooruSlug(slug)) {
      const gv = await getGelbooruPost(id);
      if (!gv) notFound();
      video = gv;
    } else {
      video = await getPost(id);
    }
  } catch {
    notFound();
  }

  const pageTitle = buildTitle(video);
  const description = buildDescription(video);
  const canonicalUrl = `https://iku.gg/watch/${video.slug}`;
  const duration = video.duration ?? undefined;

  /* Rich content from content-generator */
  const videoDescription = generateVideoDescription(video);
  const videoFAQ = generateVideoFAQ(video);
  const breadcrumbs = generateBreadcrumbs(video);
  const scorePercent = Math.round(
    (video.score / (video.score + Math.max(1, 20))) * 100
  );

  /* JSON-LD VideoObject */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: pageTitle,
    description,
    thumbnailUrl: video.thumbnail || video.preview,
    contentUrl: video.url,
    embedUrl: canonicalUrl,
    uploadDate: video.createdAt instanceof Date
      ? video.createdAt.toISOString()
      : new Date(video.createdAt).toISOString(),
    ...(duration ? { duration: `PT${Math.floor(duration)}S` } : {}),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WatchAction",
        userInteractionCount: video.favorites,
      },
    ],
    author: video.artists[0]
      ? { "@type": "Person", name: fmt(video.artists[0]) }
      : undefined,
    keywords: [
      ...video.characters.map(fmt),
      ...video.copyrights.map(fmt),
      ...video.tags.slice(0, 10).map(fmt),
      "hentai",
      "animated hentai",
    ].join(", "),
  };

  /* FAQPage JSON-LD */
  const faqJsonLd = videoFAQ.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: videoFAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  /* BreadcrumbList JSON-LD */
  const breadcrumbJsonLd = {
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
      {/* JSON-LD — VideoObject */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* JSON-LD — FAQPage */}
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {/* JSON-LD — BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="watch-page shell-content">
        <main>
          <div className="player-layout">
            {/* ── Main column ───────────────────────────────── */}
            <div className="player-main">

              {/* Breadcrumbs nav */}
              <nav className="watch-breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.url}>
                    {i > 0 && <span className="glossary-breadcrumbs__sep" aria-hidden> / </span>}
                    {i < breadcrumbs.length - 1 ? (
                      <Link
                        href={crumb.url.replace("https://iku.gg", "")}
                        className="glossary-breadcrumbs__link"
                      >
                        {crumb.name}
                      </Link>
                    ) : (
                      <span className="glossary-breadcrumbs__current" aria-current="page">
                        {crumb.name}
                      </span>
                    )}
                  </span>
                ))}
              </nav>

              {/* Video player — Gelbooru URLs are proxied through /api/proxy */}
              <div className="player-video-wrap">
                <WatchPlayer
                  src={video.url}
                  poster={video.thumbnail || undefined}
                  resolveUrl={resolvePageUrl || undefined}
                />
              </div>

              {/* H1 — must contain "hentai" for SEO */}
              <h1 className="player-title">
                {video.characters[0]
                  ? `${fmt(video.characters[0])} hentai${
                      video.copyrights[0] ? ` — ${fmt(video.copyrights[0])}` : ""
                    }`
                  : video.copyrights[0]
                  ? `${fmt(video.copyrights[0])} hentai`
                  : "Hentai video"}
              </h1>

              {/* Characters + copyrights */}
              {(video.characters.length > 0 || video.copyrights.length > 0) && (
                <div className="player-characters-row">
                  {video.characters.map((c) => (
                    <Link
                      key={c}
                      href={`/tag/${c}`}
                      className="character-pill"
                    >
                      {fmt(c)}
                    </Link>
                  ))}
                  {video.copyrights.map((c) => (
                    <Link
                      key={c}
                      href={`/tag/${c}`}
                      className="copyright-pill"
                    >
                      {fmt(c)}
                    </Link>
                  ))}
                </div>
              )}

              {/* Meta row */}
              <div className="player-meta-row">
                <span className="player-views">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                      display: "inline",
                      marginRight: "4px",
                      verticalAlign: "middle",
                    }}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {video.favorites.toLocaleString()} saved
                </span>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginLeft: "auto",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {/* Favorite + history tracking */}
                  <WatchActions
                    videoId={video.id}
                    slug={video.slug}
                    title={
                      video.characters[0]
                        ? `${fmt(video.characters[0])}${video.copyrights[0] ? ` — ${fmt(video.copyrights[0])}` : ""}`
                        : video.copyrights[0]
                        ? fmt(video.copyrights[0])
                        : video.slug
                    }
                    thumbnail={video.thumbnail}
                  />

                  <button
                    className="player-vote-btn player-vote-btn--up"
                    aria-label="Upvote"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {video.score}
                  </button>
                  <button
                    className="player-vote-btn player-vote-btn--down"
                    aria-label="Downvote"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                    </svg>
                  </button>

                  <a
                    href={
                      video.source === "rule34video"
                        ? (resolvePageUrl || `https://rule34video.com/video/${video.id}/`)
                        : video.source === "gelbooru"
                          ? `https://gelbooru.com/index.php?page=post&s=view&id=${video.id}`
                          : video.source === "rule34"
                            ? `https://rule34.xxx/index.php?page=post&s=view&id=${video.id}`
                            : `https://danbooru.donmai.us/posts/${video.id}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Source
                  </a>
                </div>
              </div>

              <div className="player-divider" />

              {/* Tag pills */}
              {video.tags.length > 0 && (
                <div className="player-tags">
                  {video.tags.slice(0, 20).map((tag) => (
                    <Link
                      key={tag}
                      href={`/tag/${tag}`}
                      className="tag-pill tag-pill--dark"
                    >
                      {fmt(tag)}
                    </Link>
                  ))}
                </div>
              )}

              {/* Auto-generated video description */}
              <p className="watch-description">{videoDescription}</p>

              {/* FAQ accordion */}
              {videoFAQ.length > 0 && (
                <div className="watch-faq">
                  <h2 className="watch-faq__heading">Frequently Asked Questions</h2>
                  {videoFAQ.map((item, i) => (
                    <details key={i} className="watch-faq__item">
                      <summary className="watch-faq__question">{item.question}</summary>
                      <p className="watch-faq__answer">{item.answer}</p>
                    </details>
                  ))}
                </div>
              )}

              {/* Artist credit */}
              {video.artists[0] && (
                <div className="player-artist-row">
                  <div
                    className="player-artist-avatar"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #ff2080, #7c3aff)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "16px",
                    }}
                  >
                    {video.artists[0].charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/tag/${video.artists[0]}`}
                      className="player-artist-name"
                    >
                      {fmt(video.artists[0])}
                    </Link>
                    <div className="player-artist-sub">Artist</div>
                  </div>
                  <Link
                    href={`/tag/${video.artists[0]}`}
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: "auto" }}
                  >
                    Browse
                  </Link>
                </div>
              )}

              {/* Score bar */}
              <div style={{ marginTop: "16px" }}>
                <div className="score-bar-wrap">
                  <div className="score-bar">
                    <div
                      className="score-bar__fill"
                      style={{ width: `${Math.min(100, scorePercent)}%` }}
                    />
                  </div>
                  <span className="score-bar__value">+{video.score}</span>
                </div>
              </div>

              {/* Duration display */}
              {video.duration && video.duration > 0 && (
                <div className="player-detail-row">
                  <span className="player-detail-label">Duration</span>
                  <span className="player-detail-value">
                    {formatDuration(video.duration)}
                  </span>
                </div>
              )}

              <div className="player-divider" />

              {/* Related — mobile grid (below player) */}
              <div style={{ marginTop: "32px" }}>
                <div className="section-header">
                  <h2
                    className="section-title"
                    style={{ fontSize: "var(--text-md)" }}
                  >
                    More hentai like this
                  </h2>
                </div>
                <Suspense
                  fallback={
                    <div className="video-grid">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="skeleton-card">
                          <div className="skeleton-thumb" />
                          <div style={{ padding: "10px 12px 12px" }}>
                            <div
                              className="skeleton-line skeleton"
                              style={{ width: "85%", marginBottom: "5px" }}
                            />
                            <div
                              className="skeleton-line skeleton"
                              style={{ width: "55%", height: "10px" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <RelatedGrid postId={video.id} />
                </Suspense>
              </div>
            </div>

            {/* ── Sidebar (desktop) ─────────────────────────── */}
            <aside className="player-sidebar">
              <div className="player-sidebar__title">Up next</div>
              <Suspense
                fallback={Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="related-item">
                    <div
                      className="related-item__thumb skeleton-thumb"
                      style={{ width: "130px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="skeleton-line skeleton"
                        style={{ width: "90%", marginBottom: "5px" }}
                      />
                      <div
                        className="skeleton-line skeleton"
                        style={{ width: "50%", height: "10px" }}
                      />
                    </div>
                  </div>
                ))}
              >
                <RelatedSidebar postId={video.id} />
              </Suspense>
            </aside>
          </div>

          {/* Footer */}
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
                  18 U.S.C. 2257
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

/* ─────────────────────────────────────────────────────────────
   Async server components — related content
───────────────────────────────────────────────────────────── */

async function RelatedGrid({ postId }: { postId: number }) {
  const related = await getRelatedPosts(postId, 8);
  if (!related.length) return null;
  return (
    <div className="video-grid">
      {related.map((v) => (
        <ThumbnailCard key={v.id} video={v} />
      ))}
    </div>
  );
}

async function RelatedSidebar({ postId }: { postId: number }) {
  const related = await getRelatedPosts(postId, 12);
  if (!related.length)
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-tertiary)",
        }}
      >
        No related videos found.
      </p>
    );

  return (
    <>
      {related.map((v) => {
        const dur = v.duration
          ? `${Math.floor(v.duration / 60)}:${Math.floor(v.duration % 60)
              .toString()
              .padStart(2, "0")}`
          : "";
        const label = v.characters[0]
          ? v.characters[0].replace(/_/g, " ")
          : v.tags
              .slice(0, 2)
              .map((t) => t.replace(/_/g, " "))
              .join(", ");
        return (
          <Link key={v.id} href={`/watch/${v.slug}`} className="related-item">
            <div className="related-item__thumb">
              {v.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={v.thumbnail} alt={label} loading="lazy" />
              )}
              {dur && (
                <span className="related-item__duration">{dur}</span>
              )}
            </div>
            <div>
              <div className="related-item__title">{label}</div>
              <div className="related-item__meta">
                {v.artists[0]?.replace(/_/g, " ") ?? "unknown"} &middot; +
                {v.score}
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}
