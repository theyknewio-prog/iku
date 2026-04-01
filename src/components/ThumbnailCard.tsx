"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Video } from "@/types/video";

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
  return diff < 48 * 60 * 60 * 1000; // 48 hours
}

/* ── Component ──────────────────────────────────────────── */

interface ThumbnailCardProps {
  video: Video;
  rank?: number;         // optional rank number (for trending)
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

  const duration = formatDuration(video.duration);
  const hot = isHot(video.score);
  const fresh = isNew(video.createdAt);
  const displayArtist = video.artists[0] ?? "";
  const displayScore = formatNumber(video.score);
  const displayFavs  = formatNumber(video.favorites);

  return (
    <Link href={`/watch/${video.slug}`} className="video-card" prefetch={false}>
      {/* ── Thumbnail media area ─────────────────────────── */}
      <div className="video-card__media">
        {video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt={video.slug}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="video-card__thumbnail"
            loading={lazy && !priority ? "lazy" : "eager"}
            priority={priority}
            unoptimized /* external Danbooru URLs */
          />
        ) : (
          /* Placeholder gradient when no thumbnail */
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #1e1e1e 0%, #141414 100%)",
            }}
          />
        )}

        {/* Play icon overlay */}
        <div className="video-card__play">
          <div className="video-card__play-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="white"
              style={{ marginLeft: "2px" }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {duration && (
          <span className="video-card__duration">{duration}</span>
        )}

        {/* Score pill — hot shows pink */}
        <span className={`video-card__score${hot ? " video-card__score--hot" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
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

        {/* Wishlist heart */}
        <button
          className={`btn-heart${wishlisted ? " active" : ""}`}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWishlisted(!wishlisted);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={wishlisted ? "#ff2080" : "none"}
            stroke={wishlisted ? "#ff2080" : "rgba(255,255,255,0.9)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Card body ────────────────────────────────────── */}
      <div className="video-card__body">
        {/* Title — 2 line clamp */}
        <h3 className="video-card__title">
          {video.characters[0]
            ? `${video.characters[0].replace(/_/g, " ")}${
                video.copyrights[0] ? ` — ${video.copyrights[0].replace(/_/g, " ")}` : ""
              }`
            : video.tags
                .slice(0, 3)
                .map((t) => t.replace(/_/g, " "))
                .join(", ") || video.slug}
        </h3>

        {/* Meta row */}
        <div className="video-card__meta">
          {showArtist && displayArtist && (
            <>
              <span
                className="video-card__artist"
                onClick={(e) => e.preventDefault()}
              >
                {displayArtist.replace(/_/g, " ")}
              </span>
              <span className="video-card__dot" />
            </>
          )}
          <span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: "inline", marginRight: "3px", verticalAlign: "middle" }}
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {displayFavs}
          </span>
        </div>
      </div>
    </Link>
  );
}
