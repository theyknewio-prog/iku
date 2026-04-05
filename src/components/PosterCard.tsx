"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { isWatched } from "@/lib/history";
import { prefetchVideoUrl, cancelPrefetch } from "@/lib/prefetch-video";

/* ── Gradient palette for fallback backgrounds (mockup thumb-grad-*) ─── */
const GRADIENTS = [
  "linear-gradient(160deg, #ff6b9d 0%, #c084fc 50%, #67e8f9 100%)",
  "linear-gradient(160deg, #f87171 0%, #fb923c 50%, #fbbf24 100%)",
  "linear-gradient(160deg, #4ade80 0%, #67e8f9 50%, #c084fc 100%)",
  "linear-gradient(160deg, #c084fc 0%, #818cf8 50%, #38bdf8 100%)",
  "linear-gradient(160deg, #fbbf24 0%, #f87171 50%, #ff6b9d 100%)",
  "linear-gradient(160deg, #67e8f9 0%, #4ade80 50%, #fbbf24 100%)",
  "linear-gradient(160deg, #ff6b9d 0%, #fbbf24 50%, #4ade80 100%)",
  "linear-gradient(160deg, #818cf8 0%, #c084fc 50%, #ff6b9d 100%)",
  "linear-gradient(160deg, #fb923c 0%, #fbbf24 50%, #67e8f9 100%)",
  "linear-gradient(160deg, #38bdf8 0%, #818cf8 50%, #f87171 100%)",
  "linear-gradient(160deg, #4ade80 0%, #c084fc 50%, #fb923c 100%)",
  "linear-gradient(160deg, #ff6b9d 0%, #c084fc 40%, #4ade80 100%)",
];

function pickGradient(id: number): string {
  return GRADIENTS[Math.abs(id) % GRADIENTS.length];
}

/* ── Genre tag colors (match mockup gt-*) ──────────────────── */
const TAG_COLORS = [
  { cls: "gt-pink",    bg: "linear-gradient(135deg, #ff6b9d, #c084fc)" },
  { cls: "gt-purple",  bg: "linear-gradient(135deg, #c084fc, #818cf8)" },
  { cls: "gt-cyan",    bg: "linear-gradient(135deg, #67e8f9, #4ade80)" },
  { cls: "gt-gold",    bg: "linear-gradient(135deg, #fbbf24, #fb923c)" },
  { cls: "gt-red",     bg: "linear-gradient(135deg, #f87171, #ff6b9d)" },
  { cls: "gt-green",   bg: "linear-gradient(135deg, #4ade80, #67e8f9)" },
];

const GENERIC_TAGS = new Set([
  "animated", "video", "sound", "tagme", "highres", "absurdres",
  "original", "solo", "1girl", "1boy", "2girls", "3girls", "multiple_girls",
  "nude", "nipples", "breasts", "pussy", "completely_nude",
]);

function pickGenreTag(video: Video): string {
  const candidate = video.tags.find((t) => !GENERIC_TAGS.has(t.toLowerCase()));
  if (candidate) return candidate.replace(/_/g, " ");
  if (video.tags.length > 0) return video.tags[0].replace(/_/g, " ");
  return "Hentai";
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function computeStars(score: number): number {
  // 3 to 5 stars based on score tiers (scores are inflated, so use generous thresholds)
  if (score >= 5000) return 5;
  if (score >= 2000) return 5;
  if (score >= 800) return 4;
  return 4;
}

function isNew(createdAt: Date): boolean {
  const now = new Date();
  const diff = now.getTime() - new Date(createdAt).getTime();
  return diff < 72 * 60 * 60 * 1000;
}

/* ── Component ──────────────────────────────────────────────── */

interface PosterCardProps {
  video: Video;
  rank?: number;
  badge?: "NEW" | "HD" | "4K" | null;
  priority?: boolean;
}

export function PosterCard({ video, rank, badge, priority = false }: PosterCardProps) {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    setWatched(isWatched(video.id));
  }, [video.id]);

  const gradient = pickGradient(video.id);
  const fresh = isNew(video.createdAt);
  const autoBadge = badge ?? (fresh ? "NEW" : null);

  const title = video.characters[0]
    ? video.characters[0].replace(/_/g, " ")
    : video.copyrights[0]
      ? video.copyrights[0].replace(/_/g, " ")
      : video.tags.slice(0, 2).map((t) => t.replace(/_/g, " ")).join(", ");

  const genreTag = pickGenreTag(video);
  const tagColor = TAG_COLORS[hashString(genreTag) % TAG_COLORS.length];
  const duration = formatDuration(video.duration);
  const stars = computeStars(video.score);
  const views = formatViews(video.score);

  return (
    <Link
      href={`/watch/${video.slug}`}
      className="poster-card"
      prefetch={false}
      style={watched ? { opacity: 0.7 } : undefined}
      onMouseEnter={() => prefetchVideoUrl(video.slug)}
      onMouseLeave={() => cancelPrefetch(video.slug)}
      onFocus={() => prefetchVideoUrl(video.slug)}
    >
      <div className="poster-card__image" style={{ background: gradient }}>
        {/* Real thumbnail */}
        {video.thumbnail && (
          <Image
            src={video.thumbnail}
            alt={title}
            fill
            sizes="(max-width: 640px) 150px, 180px"
            className="poster-card__img"
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            unoptimized
          />
        )}

        {/* Rank badge (top-left circle, replaces old badge when rank is set) */}
        {rank !== undefined ? (
          <span className="poster-card__rank-badge">{rank}</span>
        ) : autoBadge ? (
          <span
            className={`poster-card__badge poster-card__badge--${autoBadge.toLowerCase()}`}
          >
            {autoBadge}
          </span>
        ) : null}

        {/* Duration badge (bottom-right) */}
        {duration && <span className="poster-card__duration">{duration}</span>}

        {/* Watched checkmark */}
        {watched && (
          <span className="poster-card__watched" aria-label="Watched">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Shine overlay */}
        <div className="poster-card__shine" />

        {/* Play overlay (hover) */}
        <div className="poster-card__play-overlay">
          <div className="poster-card__play-btn">▶</div>
        </div>
      </div>

      {/* Info below card */}
      <div className="poster-card__info">
        <span className={`poster-card__tag ${tagColor.cls}`} style={{ background: tagColor.bg }}>
          {genreTag}
        </span>
        <div className="poster-card__title">{title}</div>
        <div className="poster-card__meta">
          <div className="poster-card__stars">
            {"★".repeat(stars)}
            <span className="poster-card__star-empty">{"★".repeat(5 - stars)}</span>
          </div>
          <span className="poster-card__views">{views} views</span>
        </div>
      </div>
    </Link>
  );
}
