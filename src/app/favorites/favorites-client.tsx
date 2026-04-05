"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  getFavorites,
  clearFavorites,
  toggleFavorite,
  type FavoriteItem,
} from "@/lib/favorites";

export interface InitialFavorite {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
}

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

interface Props {
  initialItems: InitialFavorite[] | null;
  isAuthenticated: boolean;
}

type Item = InitialFavorite | FavoriteItem;

export function FavoritesClient({ initialItems, isAuthenticated }: Props) {
  // Server-provided list takes priority for logged-in users.
  // Anonymous users fall back to localStorage.
  const [items, setItems] = useState<Item[]>(initialItems || []);
  const [mounted, setMounted] = useState(Boolean(initialItems));

  useEffect(() => {
    if (!initialItems) {
      // Anon user → read from localStorage
      setItems(getFavorites());
    }
    setMounted(true);
  }, [initialItems]);

  const handleClear = useCallback(async () => {
    if (isAuthenticated) {
      // Clear server-side by deleting each one
      await Promise.all(
        items.map((item) =>
          fetch(`/api/favorites?slug=${encodeURIComponent(item.slug)}`, {
            method: "DELETE",
          })
        )
      );
    }
    clearFavorites();
    setItems([]);
  }, [items, isAuthenticated]);

  const handleRemove = useCallback(
    async (slug: string) => {
      const item = items.find((f) => f.slug === slug);
      if (!item) return;

      if (isAuthenticated) {
        await fetch(`/api/favorites?slug=${encodeURIComponent(slug)}`, {
          method: "DELETE",
        });
      }
      // Always update localStorage mirror
      toggleFavorite({
        id: item.id,
        slug: item.slug,
        title: item.title,
        thumbnail: item.thumbnail,
      });
      setItems((prev) => prev.filter((f) => f.slug !== slug));
    },
    [items, isAuthenticated]
  );

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
              <p className="explore-header__sub">
                {items.length} saved video{items.length !== 1 ? "s" : ""}
                {isAuthenticated && items.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#4ade80" }}>
                    ✓ synced
                  </span>
                )}
              </p>
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
            {!isAuthenticated && (
              <p style={{ fontSize: "var(--text-xs)", opacity: 0.5, marginTop: "8px" }}>
                <Link href="/login" style={{ color: "#ff6b9d" }}>Sign in</Link> to sync across devices
              </p>
            )}
            <Link href="/" className="btn btn-ghost btn-sm" style={{ marginTop: "20px", display: "inline-flex" }}>
              Browse videos
            </Link>
          </div>
        )}

        {/* Favorites grid */}
        {items.length > 0 && (
          <div className="video-grid">
            {items.map((item) => (
              <FavoriteCard key={item.slug} item={item} onRemove={handleRemove} />
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
  item: Item;
  onRemove: (slug: string) => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const handleImgError = useCallback(() => setImgBroken(true), []);
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

        <button
          className="btn-heart active"
          aria-label="Remove from favorites"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(item.slug);
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
