"use client";

import { useEffect, useState } from "react";
import { addToHistory } from "@/lib/history";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

interface WatchActionsProps {
  videoId: number;
  slug: string;
  title: string;
  thumbnail: string;
}

export function WatchActions({
  videoId,
  slug,
  title,
  thumbnail,
}: WatchActionsProps) {
  const [favorited, setFavorited] = useState(false);

  /* Record watch + hydrate favorite state on mount */
  useEffect(() => {
    addToHistory(videoId, slug, thumbnail, title);
    setFavorited(isFavorite(videoId));
  }, [videoId, slug, thumbnail, title]);

  function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    const next = toggleFavorite({ id: videoId, slug, title, thumbnail });
    setFavorited(next);
  }

  return (
    <button
      onClick={handleToggleFavorite}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: favorited
          ? "1px solid rgba(255,32,128,0.5)"
          : "1px solid var(--color-border-default)",
        background: favorited
          ? "rgba(255,32,128,0.12)"
          : "var(--color-bg-muted)",
        color: favorited ? "#ff2080" : "var(--color-text-secondary)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={favorited ? "#ff2080" : "none"}
        stroke={favorited ? "#ff2080" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {favorited ? "Saved" : "Save"}
    </button>
  );
}
