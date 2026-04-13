"use client";

/**
 * StickyPremiumBanner — bottom-pinned dismissible Premium nudge for
 * non-Pro free users. Sits above the mobile bottom nav (so it
 * doesn't cover the Home/Search/Shorts tabs). Closeable via X;
 * stays dismissed for 24h via localStorage.
 *
 * Pro users + /feed (Shorts already has its own conversion CTAs) are
 * skipped entirely.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "iku-sticky-premium-dismissed-at";
const DISMISS_HOURS = 24;

export function StickyPremiumBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on /feed (handled by FeedConversionCTA) and any /preview/*.
    if (
      pathname === "/feed" ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/preview/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout")
    ) {
      return;
    }
    // Pro users skip
    if (document.body?.dataset.pro === "1") return;

    // Honor 24h dismissal
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (ts && Date.now() - ts < DISMISS_HOURS * 3600_000) return;
    } catch {
      /* localStorage may be blocked */
    }

    // Show after a 4s settle so the page mounts first.
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="iku Premium offer"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "var(--v2-bottom-nav-h, 64px)",
        zIndex: 60,
        padding: "10px 14px",
        background: "linear-gradient(135deg, #ff3d7a 0%, #8b38ff 60%, #ffbe0b 100%)",
        boxShadow: "0 -8px 22px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Link
        href="/pricing"
        onClick={dismiss}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
          textDecoration: "none",
          color: "#fff",
        }}
      >
        <span style={{ fontSize: 22 }}>✨</span>
        <span style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>
            Get iku Premium — 4.99€/mo
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Skip every ad · 4K · early access · cancel anytime
          </span>
        </span>
        <span
          style={{
            background: "#fff",
            color: "#8b38ff",
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Upgrade →
        </span>
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss for 24 hours"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
