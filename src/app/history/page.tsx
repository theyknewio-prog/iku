"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getHistory, clearHistory, type HistoryItem } from "@/lib/history";

/* ── helpers ──────────────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── page ─────────────────────────────────────────────────── */

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(getHistory());
    setMounted(true);
  }, []);

  function handleClear() {
    clearHistory();
    setItems([]);
  }

  if (!mounted) {
    return (
      <main className="shell-content">
        <div className="page-container" style={{ paddingTop: "48px" }}>
          <div className="explore-header">
            <h1 className="explore-header__title">Watch History</h1>
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
              <h1 className="explore-header__title">Watch History</h1>
              <p className="explore-header__sub">{items.length} video{items.length !== 1 ? "s" : ""} watched</p>
            </div>
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--color-error)", borderColor: "rgba(239,68,68,0.3)" }}
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--color-text-tertiary)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block", opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ fontSize: "var(--text-base)", marginBottom: "8px" }}>No history yet</p>
            <p style={{ fontSize: "var(--text-sm)", opacity: 0.6 }}>Videos you watch will appear here</p>
            <Link href="/" className="btn btn-ghost btn-sm" style={{ marginTop: "20px", display: "inline-flex" }}>
              Browse videos
            </Link>
          </div>
        )}

        {/* History grid */}
        {items.length > 0 && (
          <div className="video-grid">
            {items.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── History card — lightweight version using stored slug ──── */

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Link href={`/watch/${item.slug}`} className="video-card" prefetch={false}>
      <div className="video-card__media" style={{ background: "#141414" }}>
        {/* Watched overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span style={{
          position: "absolute",
          bottom: "6px",
          right: "6px",
          background: "rgba(0,0,0,0.75)",
          color: "var(--color-text-secondary)",
          fontSize: "var(--text-2xs)",
          padding: "2px 6px",
          borderRadius: "4px",
          zIndex: 2,
        }}>
          {timeAgo(item.timestamp)}
        </span>
      </div>
      <div className="video-card__body">
        <h3 className="video-card__title" style={{ opacity: 0.7 }}>
          #{item.id}
        </h3>
      </div>
    </Link>
  );
}
