import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ProGatedPlayer } from "@/components/ProGatedPlayer";
import { isProLocked } from "@/lib/pro-gate";
import { unlockCost } from "@/lib/unlock-cost";
import { WatchActions } from "@/components/WatchActions";
import { getGelbooruPost } from "@/lib/gelbooru";
import { getRule34Post } from "@/lib/rule34";
import { getRule34VideoPost, getRule34VideoPageUrl } from "@/lib/rule34video";
import { getWPHentaiPost, getWPHentaiPageUrl } from "@/lib/wp-hentai";
import { getHentaicityPost } from "@/lib/hentaicity";
import { getSfmCompilePost } from "@/lib/sfmcompile";
import { get3dHentaiTubePost } from "@/lib/3dhentaitube";
import { getEpornerPost } from "@/lib/eporner";
import { getGenericSourcePost } from "@/lib/generic-source";
import {
  extractIdFromSlug,
  isGelbooruSlug,
  isRule34Slug,
  isRule34VideoSlug,
  isWPHentaiSlug,
  isHentaicitySlug,
  isSfmCompileSlug,
  is3dHentaiTubeSlug,
  isEpornerSlug,
  getGenericSource,
} from "@/lib/slugify";
import type { Video } from "@/types/video";
import {
  generateVideoDescription,
  generateVideoFAQ,
  generateBreadcrumbs,
} from "@/lib/content-generator";
import {
  containsBannedContent,
  getRelatedVideos,
  getDanbooruVideo,
  isVideoDeadBySlug,
} from "@/lib/content";
import { getNonce } from "@/lib/csp-nonce";
import {
  buildSeoTitle,
  buildTitle as buildDisplayTitle,
} from "@/lib/video-display";

// ISR: pre-render zero pages at build, cache on-demand for 24h.
// The "DYNAMIC_SERVER_USAGE" errors that rolled this back the first time
// were actually PG pool exhaustion (20 conn max, 8-12 queries per render,
// 47k timeouts in the old container) cascading into fake dynamic errors.
// Fixed by bumping pool max to 50, memoizing source getPost functions,
// and consolidating getRelatedVideos into a single max-12 fetch.
export const generateStaticParams = async (): Promise<{ slug: string }[]> => [];
export const dynamicParams = true;
export const revalidate = 86400;

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

/** SEO-optimized title for metadata — delegates to shared buildSeoTitle */
function buildTitle(video: Video): string {
  return buildSeoTitle(video);
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
    const genericSource = getGenericSource(slug);
    if (genericSource) {
      const gv = await getGenericSourcePost(genericSource, id);
      if (!gv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = gv;
    } else if (isHentaicitySlug(slug)) {
      const hv = await getHentaicityPost(id);
      if (!hv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = hv;
    } else if (isSfmCompileSlug(slug)) {
      const sv = await getSfmCompilePost(id);
      if (!sv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = sv;
    } else if (is3dHentaiTubeSlug(slug)) {
      const tv = await get3dHentaiTubePost(id);
      if (!tv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = tv;
    } else if (isEpornerSlug(slug)) {
      const ev = await getEpornerPost(id);
      if (!ev)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = ev;
    } else if (isWPHentaiSlug(slug)) {
      const wv = await getWPHentaiPost(id);
      if (!wv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = wv;
    } else if (isRule34VideoSlug(slug)) {
      const rv = await getRule34VideoPost(id);
      if (!rv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = rv;
    } else if (isRule34Slug(slug)) {
      const rv = await getRule34Post(id);
      if (!rv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = rv;
    } else if (isGelbooruSlug(slug)) {
      const gv = await getGelbooruPost(id);
      if (!gv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = gv;
    } else {
      // PG-first lookup; no live fallback for metadata so cold renders stay fast.
      const dv = await getDanbooruVideo(id, { liveFallback: false });
      if (!dv)
        return { title: "Hentai Video | iku.gg", robots: { index: false } };
      video = dv;
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
  const ogImage =
    video.thumbnail || video.preview || "https://iku.gg/og-default.png";
  const ogVideo = video.url;

  // SEO: noindex when the source video is dead. Page still renders with
  // auto-skip fallback for users who land via direct link, but Google
  // drops the URL on next crawl.
  const isDead = await isVideoDeadBySlug(video.slug);

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
      index: !isDead,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "iku.gg",
      type: "video.other",
      images: [
        {
          url: ogImage,
          width: video.width || 1200,
          height: video.height || 630,
          alt: title,
        },
      ],
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
      images: [ogImage],
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
  const nonce = await getNonce();
  const { slug } = await params;

  let video: Video;
  let resolvePageUrl: string | null = null;
  let streamProxyUrl: string | null = null;
  try {
    const id = extractIdFromSlug(slug);
    const genericSource = getGenericSource(slug);
    if (genericSource) {
      const gv = await getGenericSourcePost(genericSource, id);
      if (!gv) notFound();
      video = gv;
      // All generic sources serve MP4s directly from their own CDN.
      // Proxy through /api/video-stream so the source host never appears
      // in the user's DOM/devtools and Range handling stays uniform.
      if (gv.url) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(gv.url)}`;
      }
    } else if (isHentaicitySlug(slug)) {
      const hv = await getHentaicityPost(id);
      if (!hv) notFound();
      video = hv;
      // hentaicity serves MP4 directly — we proxy through /api/video-stream
      // to dodge potential CORS or Referer checks and keep user IPs hidden.
      if (hv.url) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(hv.url)}`;
      }
    } else if (isSfmCompileSlug(slug)) {
      const sv = await getSfmCompilePost(id);
      if (!sv) notFound();
      video = sv;
      // sfmcompile self-hosts MP4s on wp-content/uploads — no token, no
      // CORS, but we still proxy so the source domain never leaks.
      if (sv.url) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(sv.url)}`;
      }
    } else if (is3dHentaiTubeSlug(slug)) {
      const tv = await get3dHentaiTubePost(id);
      if (!tv) notFound();
      video = tv;
      if (tv.url) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(tv.url)}`;
      }
    } else if (isEpornerSlug(slug)) {
      const ev = await getEpornerPost(id);
      if (!ev) notFound();
      video = ev;
      // eporner MP4 URLs are IP-bound at resolve time — yt-dlp on our
      // server resolves from the canonical page URL, and video-stream
      // streams bytes from our IP.
      const pageUrl = ev.pageUrl || ev.url;
      if (pageUrl) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(pageUrl)}`;
      }
    } else if (isWPHentaiSlug(slug)) {
      const wv = await getWPHentaiPost(id);
      if (!wv) notFound();
      video = wv;
      resolvePageUrl = await getWPHentaiPageUrl(id);
      if (resolvePageUrl) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(resolvePageUrl)}`;
      }
    } else if (isRule34VideoSlug(slug)) {
      const rv = await getRule34VideoPost(id);
      if (!rv) notFound();
      video = rv;
      resolvePageUrl = await getRule34VideoPageUrl(id);
      if (resolvePageUrl) {
        streamProxyUrl = `/api/video-stream?url=${encodeURIComponent(resolvePageUrl)}`;
      }
    } else if (isRule34Slug(slug)) {
      const rv = await getRule34Post(id);
      if (!rv) notFound();
      video = rv;
    } else if (isGelbooruSlug(slug)) {
      const gv = await getGelbooruPost(id);
      if (!gv) notFound();
      video = gv;
    } else {
      // PG-first, live fallback only for fresh unscraped posts.
      const dv = await getDanbooruVideo(id, { liveFallback: true });
      if (!dv) notFound();
      video = dv;
    }
  } catch {
    notFound();
  }

  // Block banned content from being viewed directly
  if (containsBannedContent(video)) {
    notFound();
  }

  // SEO: 308 (≈301) redirect when URL slug doesn't match the canonical DB
  // slug. Prevents duplicate content from people forging /watch/<id>-anything
  // (Google indexed many of these). Routing is by ID extracted from slug,
  // so any cosmetic suffix used to silently render the same page.
  if (slug !== video.slug) {
    permanentRedirect(`/watch/${video.slug}`);
  }

  // Fetch related for autoplay-next (small set, no suspense needed)
  let relatedForPlayer: { slug: string; thumbnail: string; title: string }[] =
    [];
  try {
    const related = await getRelatedVideos(video, 4);
    relatedForPlayer = related.map((v) => ({
      slug: v.slug,
      thumbnail: v.thumbnail || v.preview || "",
      // Use the shared buildDisplayTitle so "Up Next" labels match the rest
      // of the app (card grid, h1, metadata).
      title: buildDisplayTitle(v),
    }));
  } catch {
    // Related fetch failed, autoplay won't work but video still plays
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
    (video.score / (video.score + Math.max(1, 20))) * 100,
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
    uploadDate:
      video.createdAt instanceof Date
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
  const faqJsonLd =
    videoFAQ.length > 0
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
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* JSON-LD — FAQPage */}
      {faqJsonLd && (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {/* JSON-LD — BreadcrumbList */}
      <script
        type="application/ld+json"
        nonce={nonce}
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

              {/* Video player — Gelbooru URLs are proxied through /api/proxy,
                  Rule34Video + WP are proxied through /api/video-stream to
                  bypass IP-bound access tokens.
                  CRITICAL: For rule34video/wp sources, video.url is the raw
                  upstream MP4 with an IP-bound token that returns 403 in the
                  browser (CLAUDE.md silent bug). We MUST use streamProxyUrl
                  for those sources. Short-circuiting via `||` would always
                  return the raw URL and break 78% of the catalog. */}
              <div className="player-video-wrap">
                {isProLocked(video) ? (
                  <ProGatedPlayer
                    src={streamProxyUrl || video.url || ""}
                    poster={video.thumbnail || undefined}
                    resolveUrl={resolvePageUrl || undefined}
                    relatedVideos={relatedForPlayer}
                    lockedThumbnail={video.thumbnail || null}
                    lockedTitle={buildDisplayTitle(video)}
                    videoPk={video.pk ?? 0}
                    unlockCost={unlockCost(video)}
                  />
                ) : (
                  <WatchPlayer
                    src={streamProxyUrl || video.url || ""}
                    poster={video.thumbnail || undefined}
                    resolveUrl={resolvePageUrl || undefined}
                    slug={video.slug}
                    relatedVideos={relatedForPlayer}
                  />
                )}
              </div>

              {/* Signup nudge unmounted 2026-05-01 per user request:
                  no account-creation push during video playback. */}

              {/* H1 — uses buildDisplayTitle so videos without character/copy
                  metadata still get a real title (scraped title or tag) instead
                  of the generic "Hentai video" placeholder. */}
              <h1 className="player-title">
                {(() => {
                  const base = buildDisplayTitle(video);
                  return /hentai/i.test(base) ? base : `${base} Hentai`;
                })()}
              </h1>

              {/* Characters + copyrights */}
              {(video.characters.length > 0 || video.copyrights.length > 0) && (
                <div className="player-characters-row">
                  {video.characters.map((c) => (
                    <Link
                      key={c}
                      href={`/character/${encodeURIComponent(c)}`}
                      className="character-pill"
                    >
                      {fmt(c)}
                    </Link>
                  ))}
                  {video.copyrights.map((c) => (
                    <Link key={c} href={`/tag/${c}`} className="copyright-pill">
                      {fmt(c)}
                    </Link>
                  ))}
                </div>
              )}

              {/* Social action bar — views · like/dislike ratio · save · share.
                  Opsec: no "Source" button (would leak upstream provider name
                  to the user per feedback_public_copy_opsec). */}
              <WatchActions
                videoId={video.id}
                slug={video.slug}
                title={
                  video.characters[0]
                    ? `${fmt(video.characters[0])}${video.copyrights[0] ? ` — ${fmt(video.copyrights[0])}` : ""}`
                    : video.copyrights[0]
                      ? fmt(video.copyrights[0])
                      : buildDisplayTitle(video)
                }
                thumbnail={video.thumbnail}
                initialFavorites={video.favorites}
                initialScore={video.score}
              />

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

              {/* FAQ accordion — renders rich answerHtml (internal links) when
                  present. content-generator escapes every user/source value
                  before building answerHtml. Plain-text `answer` stays the
                  canonical version in the FAQPage JSON-LD above. */}
              {videoFAQ.length > 0 && (
                <section
                  className="watch-faq"
                  aria-labelledby="watch-faq-heading"
                >
                  <h2 id="watch-faq-heading" className="watch-faq__heading">
                    Frequently Asked Questions
                  </h2>
                  {videoFAQ.map((item, i) => (
                    <details key={i} className="watch-faq__item">
                      <summary className="watch-faq__question">
                        {item.question}
                      </summary>
                      {item.answerHtml ? (
                        <p
                          className="watch-faq__answer"
                          dangerouslySetInnerHTML={{ __html: item.answerHtml }}
                        />
                      ) : (
                        <p className="watch-faq__answer">{item.answer}</p>
                      )}
                    </details>
                  ))}
                </section>
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
                  <RelatedGrid video={video} />
                </Suspense>
              </div>
            </div>

            {/* ── Sidebar (desktop) ─────────────────────────── */}
            <aside className="player-sidebar">
              <div className="player-sidebar__title">Up next</div>
              <Suspense
                fallback={Array.from({ length: 12 }).map((_, i) => (
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
                <RelatedSidebar video={video} offset={0} limit={12} />
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

/* ─────────────────────────────────────────────────────────────
   Async server components — related content
───────────────────────────────────────────────────────────── */

async function RelatedGrid({ video }: { video: Video }) {
  const related = await getRelatedVideos(video, 8);
  if (!related.length) return null;
  return (
    <div className="video-grid">
      {related.map((v) => (
        <ThumbnailCard key={v.id} video={v} />
      ))}
    </div>
  );
}

async function RelatedSidebar({
  video,
  offset = 0,
  limit = 12,
}: {
  video: Video;
  offset?: number;
  limit?: number;
}) {
  // getRelatedVideos is memoized so calling it twice (top + bottom slot)
  // for the same video hits the same cached result, no extra PG load.
  const all = await getRelatedVideos(video, 12);
  const related = all.slice(offset, offset + limit);
  if (!related.length) {
    if (offset === 0) {
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
    }
    return null;
  }

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
              {dur && <span className="related-item__duration">{dur}</span>}
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
