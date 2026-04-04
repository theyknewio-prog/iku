"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { getFavorites, clearFavorites, toggleFavorite, type FavoriteItem } from "@/lib/favorites";

/* ── Gradient palette for broken/missing thumbnails ─────────── */
const CARD_GRADIENTS = [
  "linear-gradient(135deg,#2d1b4e,#1a0a2e)",
  "linear-gradient(135deg,#1a2744,#0d1a3a)",
  "linear-gradient(135deg,#2a1040,#180830)",
  "linear-gradient(135deg,#1e1040,#2a0040)",
  "linear-gradient(135deg,#0d2030,#0a1525)",
  "linear-gradient(135deg,#301020,#1a0815)",
  "linear-gradient(135deg,#1a2030,#0f1520)",
  "linear-gradient(135deg,#280a3a,#150520)",
];

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(getFavorites());
    setMounted(true);
  }, []);

  function handleClear() {
    clearFavorites();
    setItems([]);
  }

  function handleRemove(id: number) {
    const item = items.find((f) => f.id === id);
    if (!item) return;
    toggleFavorite({ id: item.id, slug: item.slug, title: item.title, thumbnail: item.thumbnail });
    setItems((prev) => prev.filter((f) => f.id !== id));
  }

  if (!mounted) {
    return (
      <main className="shell-content">
        <div className="page-container" style={{ paddingTop: "48px" }}>
          <div className="explore-header">
            <h1 className="explore-header__title">Favorites</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell-content">
      <div className="page-container" style={{ paddingTop: "48px", paddingBottom: "80px" }}>

        {/* Header */}
        <div className="explore-header" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 className="explore-header__title">Favorites</h1>
              <p className="explore-header__sub">{items.length} saved video{items.length !== 1 ? "s" : ""}</p>
            </div>
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--color-error)", borderColor: "rgba(239,68,68,0.3)" }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--color-text-tertiary)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block", opacity: 0.3 }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p style={{ fontSize: "var(--text-base)", marginBottom: "8px" }}>No favorites yet</p>
            <p style={{ fontSize: "var(--text-sm)", opacity: 0.6 }}>Tap the heart on any video to save it here</p>
            <Link href="/" className="btn btn-ghost btn-sm" style={{ marginTop: "20px", display: "inline-flex" }}>
              Browse videos
            </Link>
          </div>
        )}

        {/* Favorites grid */}
        {items.length > 0 && (
          <div className="video-grid">
            {items.map((item) => (
              <FavoriteCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Favorite card ─────────────────────────────────────────── */

function FavoriteCard({
  item,
  onRemove,
}: {
  item: FavoriteItem;
  onRemove: (id: number) => void;
}) {
  // Track whether the stored thumbnail URL failed to load.
  const [imgBroken, setImgBroken] = useState(false);
  const handleImgError = useCallback(() => setImgBroken(true), []);

  // Stable gradient derived from the video id for broken/missing thumbnails.
  const gradientBg = CARD_GRADIENTS[item.id % CARD_GRADIENTS.length];

  return (
    <Link href={`/watch/${item.slug}`} className="video-card" prefetch={false}>
      <div className="video-card__media">
        {item.thumbnail && !imgBroken ? (
          <Image
            src={item.thumbnail}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="video-card__thumbnail"
            loading="lazy"
            unoptimized
            onError={handleImgError}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: gradientBg }} />
        )}

        {/* Remove button */}
        <button
          className="btn-heart active"
          aria-label="Remove from favorites"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(item.id);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#ff2080" stroke="#ff2080" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="video-card__body">
        <h3 className="video-card__title">{item.title}</h3>
      </div>
    </Link>
  );
}
