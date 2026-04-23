"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import type { Video } from "@/types/video";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { isWatched } from "@/lib/history";
import { prefetchVideoUrl, cancelPrefetch } from "@/lib/prefetch-video";
import { buildTitle } from "@/lib/video-display";
import { isProLocked } from "@/lib/pro-gate";

/* ── Helpers ─────────────────────────────────────────────── */

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function isHot(score: number): boolean {
  return score >= 200;
}

function isNew(createdAt: Date): boolean {
  const now = new Date();
  const diff = now.getTime() - new Date(createdAt).getTime();
  return diff < 48 * 60 * 60 * 1000;
}

/* ── Component ──────────────────────────────────────────── */

interface ThumbnailCardProps {
  video: Video;
  rank?: number;
  showArtist?: boolean;
  lazy?: boolean;
  priority?: boolean;
}

export function ThumbnailCard({
  video,
  rank,
  showArtist = true,
  lazy = true,
  priority = false,
}: ThumbnailCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const [watched, setWatched] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [progress, setProgress] = useState(0);
  // Some thumbnails (notably old rule34video screencaps) 404 because the
  // upstream CDN garbage-collected them. Track per-card so we can swap to
  // a gradient fallback instead of showing a broken-image icon.
  const [imgError, setImgError] = useState(false);
  // Some thumbnail CDNs (cdn.donmai.us) block flagged residential IPs with 403.
  // On first error for a supported host, retry via /api/proxy which fetches
  // from our Hetzner IP. Only flips to gradient if the proxy fails too.
  const [proxyRetry, setProxyRetry] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Hydrate localStorage state client-side */
  useEffect(() => {
    setWishlisted(isFavorite(video.id));
    setWatched(isWatched(video.id));
  }, [video.id]);

  const duration = formatDuration(video.duration);
  const hot = isHot(video.score);
  const fresh = isNew(video.createdAt);
  const displayArtist = video.artists[0] ?? "";
  const displayScore = formatNumber(video.score);
  const displayFavs = formatNumber(video.favorites);

  // Quality badge — inferred from video width (2026-04-12 competitor audit
  // pattern: SpankBang/XVideos display HD/4K badges prominently on thumb).
  // 4K (≥2160px) > HD (≥720px) > none.
  const quality =
    video.width >= 2160
      ? "4K"
      : video.width >= 1080
        ? "HD"
        : video.width >= 720
          ? "SD+"
          : "";

  // Pro-gated content gets a "Premium" lock badge so free users know
  // upfront which videos are paywalled (no surprise on click).
  const proLocked = isProLocked(video);

  /* Title — uses buildTitle for consistent display across all cards
     (scraped title → character → copyright → meaningful tag → fallback) */
  const title = buildTitle(video);

  /* ── Hover handlers — 300ms debounce before loading video ── */
  const canPreview = !!video.url;

  const handleMouseEnter = useCallback(() => {
    // Warm the resolved URL cache on hover — by the time the user clicks,
    // the /api/resolve-video result is already in L1/L2 cache.
    prefetchVideoUrl(video.slug);
    if (!canPreview) return;
    hoverTimerRef.current = setTimeout(() => {
      const el = videoRef.current;
      if (!el || !video.url) return;
      if (!el.src) {
        el.src = video.url;
        el.load();
      }
      // Silent: hover-triggered preview may be rejected (not a user gesture
      // in autoplay-restricted browsers). We just stay on the thumbnail.
      el.play().catch(() => {
        /* hover preview autoplay denied */
      });
      setPreviewActive(true);
    }, 300);
  }, [video.url, video.slug, canPreview]);

  const handleMouseLeave = useCallback(() => {
    cancelPrefetch(video.slug);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPreviewActive(false);
    setProgress(0);
  }, [video.slug]);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  }, []);

  /* Derive the video title for favorites storage */
  const videoTitle = title;

  return (
    <Link
      href={`/watch/${video.slug}`}
      className="video-card"
      prefetch={false}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={watched ? { opacity: 0.75 } : undefined}
    >
      {/* ── Thumbnail media area ─────────────────────────── */}
      <div className="video-card__media">
        {/* Static thumbnail — falls back to a gradient when the upstream
            image 404s (rule34video old-asset GC). */}
        {video.thumbnail && !imgError ? (
          <Image
            src={
              proxyRetry && /^https:\/\/cdn\.donmai\.us\//.test(video.thumbnail)
                ? `/api/proxy?url=${encodeURIComponent(video.thumbnail)}`
                : video.thumbnail
            }
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            className="video-card__thumbnail"
            loading={lazy && !priority ? "lazy" : "eager"}
            priority={priority}
            unoptimized
            // hanime1 CDN (vdownload.hembed.com) returns 403 when Referer is
            // set to iku.gg (hotlink protection). no-referrer makes the
            // browser omit Referer entirely → CDN serves the image. Safe for
            // every other source because we never rely on Referer upstream.
            referrerPolicy="no-referrer"
            onError={() => {
              if (
                !proxyRetry &&
                /^https:\/\/cdn\.donmai\.us\//.test(video.thumbnail)
              ) {
                setProxyRetry(true);
              } else {
                setImgError(true);
              }
            }}
          />
        ) : (
          // Thumbnail fallback — upstream image 404'd (Danbooru rotates
          // cached hashes, Rule34Video GCs old assets). A flower emoji
          // read "broken site" on listing pages with many 404s. A flat
          // dark panel with a play glyph reads "video loaded, preview
          // unavailable" — closer to the truth and premium-looking.
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(40,15,45,0.95) 0%, rgba(20,10,30,0.98) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.18)",
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </div>
        )}

        {/* Hover video preview */}
        <video
          ref={videoRef}
          className="video-card__preview"
          loop
          muted
          playsInline
          preload="none"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ referrerpolicy: "no-referrer" } as any)}
          onTimeUpdate={handleTimeUpdate}
          style={{ opacity: previewActive ? 1 : 0 }}
        />

        {/* Watched checkmark badge */}
        {watched && (
          <span
            aria-label="Watched"
            style={{
              position: "absolute",
              top: "6px",
              left: "6px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Duration badge — bottom right */}
        {duration && <span className="video-card__duration">{duration}</span>}

        {/* Quality badge — bottom left, SpankBang-style */}
        {quality && (
          <span
            className={`video-card__quality video-card__quality--${quality.toLowerCase().replace("+", "p")}`}
          >
            {quality}
          </span>
        )}

        {/* Score pill — top left (shifted right if watched badge present) */}
        <span
          className={`video-card__score${hot ? " video-card__score--hot" : ""}`}
          style={watched ? { left: "28px" } : undefined}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {displayScore}
        </span>

        {/* Rank badge */}
        {rank !== undefined && (
          <span
            className={`rank-badge ${
              rank === 1
                ? "rank-badge--1"
                : rank === 2
                  ? "rank-badge--2"
                  : rank === 3
                    ? "rank-badge--3"
                    : "rank-badge--n"
            }`}
          >
            {rank}
          </span>
        )}

        {/* NEW badge */}
        {fresh && rank === undefined && !proLocked && (
          <span className="video-card__new">New</span>
        )}

        {/* Premium lock badge — top right on Pro-gated videos */}
        {proLocked && (
          <span
            aria-label="Premium — full episode"
            title="Full episode — Premium or unlock with points"
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              background: "linear-gradient(135deg, #ff7a00 0%, #ff3b00 100%)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              boxShadow: "0 2px 6px rgba(255,122,0,0.4)",
              zIndex: 4,
            }}
          >
            🔒 Premium
          </span>
        )}

        {/* Wishlist heart — uses favorites.ts */}
        <button
          className={`btn-heart${wishlisted ? " active" : ""}`}
          aria-label={wishlisted ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const newState = toggleFavorite({
              id: video.id,
              slug: video.slug,
              title: videoTitle,
              thumbnail: video.thumbnail,
            });
            setWishlisted(newState);
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={wishlisted ? "#ff2080" : "none"}
            stroke={wishlisted ? "#ff2080" : "rgba(255,255,255,0.85)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Progress bar — shown on hover, fills as video plays */}
        <div className="video-card__progress">
          <div
            className="video-card__progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* ── Card body — Sab spec 2026-04-12: keep only title + ★★★★★ + views.
             Artist name + first-tag chip removed to match hanime/SpankBang's
             minimalist meta convention (2026-04-12 redesign pass). */}
      <div className="video-card__body">
        <h3 className="video-card__title">{title}</h3>

        <div className="video-card__meta">
          <span
            className="video-card__stars"
            aria-label={`Rating ${(video.score >= 500 ? 5 : video.score >= 200 ? 4.5 : video.score >= 50 ? 4 : 3.5).toFixed(1)} out of 5`}
          >
            {"★★★★★"}
          </span>
          <span className="video-card__views">{displayScore} views</span>
        </div>
      </div>
    </Link>
  );
}
