import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { WatchPlayerWithPreroll } from "@/components/WatchPlayerWithPreroll";
import { WatchSignupNudge } from "@/components/WatchSignupNudge";
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
} from "@/lib/content";
import { getNonce } from "@/lib/csp-nonce";
import { HentaiProsBanner } from "@/components/HentaiProsBanner";
import { HilltopAdsBanner } from "@/components/HilltopAdsBanner";
import { AdZoneClient } from "@/components/AdZoneClient";
import { AD_ZONES } from "@/lib/ad-config";
import { RemoveAdsCTA } from "@/components/RemoveAdsCTA";
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
    if (isHentaicitySlug(slug)) {
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
    if (isHentaicitySlug(slug)) {
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

              {/* Wave 3 ad reintro 2026-04-13: above-player banner.
                  Desktop = ExoClick 728x90 leaderboard (zone 5893256).
                  Mobile  = ExoClick 300x50 mobile sticky (zone 5895978).
                  AdZoneClient handles the swap via window.innerWidth. */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  margin: "12px 0",
                }}
              >
                <AdZoneClient
                  zoneId={AD_ZONES.exoclick.watchUnderplayer728}
                  size="728x90"
                  mobileZoneId={
                    AD_ZONES.exoclick.mobileBanner300x50 ?? undefined
                  }
                  mobileSize="300x50"
                />
              </div>

              {/* Video player — Gelbooru URLs are proxied through /api/proxy,
                  Rule34Video + WP are proxied through /api/video-stream to
                  bypass IP-bound access tokens.
                  CRITICAL: For rule34video/wp sources, video.url is the raw
                  upstream MP4 with an IP-bound token that returns 403 in the
                  browser (CLAUDE.md silent bug). We MUST use streamProxyUrl
                  for those sources. Short-circuiting via `||` would always
                  return the raw URL and break 78% of the catalog.

                  Swapped from WatchPlayerWithPreroll (which wrapped WatchPlayer
                  in a 15s ExoClick preroll) to bare WatchPlayer 2026-04-11
                  night as part of the ad blackout — the preroll was an ad
                  surface we weren't verifying. */}
              <div className="player-video-wrap">
                {isProLocked(video) ? (
                  <ProGatedPlayer
                    src={
                      video.source === "rule34video" ||
                      video.source === "wp" ||
                      video.source === "hentaicity" ||
                      video.source === "sfmcompile"
                        ? streamProxyUrl || ""
                        : video.url || ""
                    }
                    poster={video.thumbnail || undefined}
                    resolveUrl={resolvePageUrl || undefined}
                    relatedVideos={relatedForPlayer}
                    lockedThumbnail={video.thumbnail || null}
                    lockedTitle={buildDisplayTitle(video)}
                    videoPk={video.pk ?? 0}
                    unlockCost={unlockCost(video)}
                  />
                ) : (
                  <WatchPlayerWithPreroll
                    src={
                      video.source === "rule34video" ||
                      video.source === "wp" ||
                      video.source === "hentaicity" ||
                      video.source === "sfmcompile"
                        ? streamProxyUrl || ""
                        : video.url || ""
                    }
                    poster={video.thumbnail || undefined}
                    resolveUrl={resolvePageUrl || undefined}
                    slug={video.slug}
                    relatedVideos={relatedForPlayer}
                  />
                )}
              </div>

              {/* Single HentaiPros 300x250 under player (verified working via
                  Playwright). All other ad zones removed 2026-04-11. */}
              <div style={{ margin: "12px auto", textAlign: "center" }}>
                <HentaiProsBanner format="300x250" mobileFormat={null} />
              </div>

              {/* Remove Ads CTA — only for non-Pro, non-logged-in users */}
              <RemoveAdsCTA />

              {/* Signup nudge after 30s for anon users */}
              <WatchSignupNudge />

              {/* H1 — uses buildDisplayTitle so videos without character/copy
                  metadata still get a real title (scraped title or tag) instead
                  of the generic "Hentai video" placeholder. */}
              <h1 className="player-title">
                {(() => {
                  const base = buildDisplayTitle(video);
                  return /hentai/i.test(base) ? base : `${base} Hentai`;
                })()}
              </h1>

              {/* Premium nudge under H1 — slim gradient strip pushing /pricing. */}
              <Link
                href="/pricing"
                className="hp-premium-strip"
                aria-label="Get iku Premium"
              >
                <span className="hp-premium-strip__icon">🚫</span>
                <span className="hp-premium-strip__text">
                  <strong>Skip every preroll + ad</strong> · 4K when available ·
                  Early access · Unlimited favorites
                </span>
                <span className="hp-premium-strip__cta">
                  Premium 4.99€/mo →
                </span>
              </Link>

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
                        ? resolvePageUrl ||
                          `https://rule34video.com/video/${video.id}/`
                        : video.source === "gelbooru"
                          ? `https://gelbooru.com/index.php?page=post&s=view&id=${video.id}`
                          : video.source === "rule34"
                            ? `https://rule34.xxx/index.php?page=post&s=view&id=${video.id}`
                            : video.source === "hentaicity"
                              ? video.pageUrl || `https://www.hentaicity.com`
                              : video.source === "sfmcompile"
                                ? video.pageUrl || "https://iku.gg"
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
                  <h2 className="watch-faq__heading">
                    Frequently Asked Questions
                  </h2>
                  {videoFAQ.map((item, i) => (
                    <details key={i} className="watch-faq__item">
                      <summary className="watch-faq__question">
                        {item.question}
                      </summary>
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
                {/* A/B test 2026-04-18: HilltopAds 300x250 (zone 6969681)
                    replacing ExoClick sidebar300 lazy in this in-content slot.
                    Same spot, direct eCPM comparison vs Adsterra baseline
                    ($0.36) over 48h. If HilltopAds fills and pays, scale to
                    other surfaces; if not, revert. */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    margin: "0 0 20px",
                  }}
                >
                  <HilltopAdsBanner format="banner300x250" />
                </div>
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
              {/* CPM densification 2026-04-15: ExoClick 300x250 above
                  HentaiPros. Sidebar is display:none <768px so this is
                  a desktop-only surface. lazy={true} 2026-04-18 — desktop
                  has 3 eager ad zones above fold (under-player HentaiPros
                  iframe + this one + sidebar 160x600). IntersectionObserver
                  pushes ExoClick script injection after first paint even
                  though the zone is visible, cutting time-to-interactive. */}
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <AdZoneClient
                  zoneId={AD_ZONES.exoclick.sidebar300}
                  size="300x250"
                  lazy
                />
              </div>
              {/* Wave 1b 2026-04-13: swapped generic ExoClick for
                  HentaiProsBanner 160x600 — hentai-niche rotation
                  (HentaiPros / Candy.ai / hentai games) matches the
                  audience intent. Sidebar is display:none <768px. */}
              <HentaiProsBanner format="160x600" mobileFormat={null} />
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
                <RelatedSidebar video={video} />
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

async function RelatedSidebar({ video }: { video: Video }) {
  const related = await getRelatedVideos(video, 12);
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
