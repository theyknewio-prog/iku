"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import type { Video } from "@/types/video";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { isWatched } from "@/lib/history";

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
  const displayFavs  = formatNumber(video.favorites);

  /* Title — character + copyright or fallback tags */
  const title = video.characters[0]
    ? `${video.characters[0].replace(/_/g, " ")}${
        video.copyrights[0] ? ` — ${video.copyrights[0].replace(/_/g, " ")}` : ""
      }`
    : video.tags
        .slice(0, 3)
        .map((t) => t.replace(/_/g, " "))
        .join(", ") || video.slug;

  /* ── Hover handlers — 300ms debounce before loading video ── */
  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      const el = videoRef.current;
      if (!el || !video.url) return;
      if (!el.src) {
        el.src = video.url;
        el.load();
      }
      el.play().catch(() => {});
      setPreviewActive(true);
    }, 300);
  }, [video.url]);

  const handleMouseLeave = useCallback(() => {
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
  }, []);

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
        {/* Static thumbnail */}
        {video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            className="video-card__thumbnail"
            loading={lazy && !priority ? "lazy" : "eager"}
            priority={priority}
            unoptimized
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #141414 0%, #0f0f0f 100%)",
            }}
          />
        )}

        {/* Hover video preview */}
        <video
          ref={videoRef}
          className="video-card__preview"
          loop
          muted
          playsInline
          preload="none"
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Duration badge — bottom right */}
        {duration && (
          <span className="video-card__duration">{duration}</span>
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
        {fresh && rank === undefined && (
          <span className="video-card__new">New</span>
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

      {/* ── Card body ────────────────────────────────────── */}
      <div className="video-card__body">
        {/* Artist name — accent color, prominent */}
        {showArtist && displayArtist && (
          <span className="video-card__artist-label">
            {displayArtist.replace(/_/g, " ")}
          </span>
        )}

        {/* Title */}
        <h3 className="video-card__title">{title}</h3>

        {/* Meta row — views + score */}
        <div className="video-card__meta">
          <span className="video-card__meta-item">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: "inline", verticalAlign: "middle" }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {" "}{displayFavs}
          </span>
          {video.tags[0] && (
            <>
              <span className="video-card__dot" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80px" }}>
                {video.tags[0].replace(/_/g, " ")}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
