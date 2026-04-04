"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { isWatched } from "@/lib/history";

/* ── Gradient palette for fallback backgrounds ─────────────── */
const GRADIENTS = [
  "linear-gradient(160deg, #1a0a2e 0%, #e8467c 100%)",
  "linear-gradient(160deg, #0d1a2e 0%, #7b2ff7 100%)",
  "linear-gradient(160deg, #2e0d0d 0%, #e8467c 60%, #ff9a44 100%)",
  "linear-gradient(160deg, #0a2e1a 0%, #22c55e 100%)",
  "linear-gradient(160deg, #2e1a0a 0%, #f59e0b 100%)",
  "linear-gradient(160deg, #1a0a2e 0%, #06b6d4 100%)",
  "linear-gradient(160deg, #2e0a1a 0%, #f43f5e 100%)",
  "linear-gradient(160deg, #0a1a2e 0%, #3b82f6 100%)",
  "linear-gradient(160deg, #1e0a30 0%, #a855f7 100%)",
  "linear-gradient(160deg, #2e1a00 0%, #fb923c 100%)",
];

function pickGradient(id: number): string {
  return GRADIENTS[id % GRADIENTS.length];
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
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

  const sub = video.copyrights[0]
    ? video.copyrights[0].replace(/_/g, " ")
    : `Score ${formatScore(video.score)}`;

  return (
    <Link
      href={`/watch/${video.slug}`}
      className="poster-card"
      prefetch={false}
      style={watched ? { opacity: 0.7 } : undefined}
    >
      <div className="poster-card__image" style={{ background: gradient }}>
        {/* Real thumbnail */}
        {video.thumbnail && (
          <Image
            src={video.thumbnail}
            alt={title}
            fill
            sizes="(max-width: 640px) 140px, 180px"
            className="poster-card__img"
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            unoptimized
          />
        )}

        {/* Badge */}
        {autoBadge && (
          <span
            className={`poster-card__badge poster-card__badge--${autoBadge.toLowerCase()}`}
          >
            {autoBadge}
          </span>
        )}

        {/* Rank number (top10 style) */}
        {rank !== undefined && (
          <span className="poster-card__rank">{rank}</span>
        )}

        {/* Watched checkmark */}
        {watched && (
          <span
            aria-label="Watched"
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Shine overlay */}
        <div className="poster-card__shine" />

        {/* Play hint */}
        <div className="poster-card__play-hint">
          <div className="poster-card__play-inner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </div>

      </div>

      {/* Info below card */}
      <div className="poster-card__info">
        <div className="poster-card__name">{title}</div>
        <div className="poster-card__sub">{sub}</div>
      </div>
    </Link>
  );
}
