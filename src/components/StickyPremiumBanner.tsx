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
    // IMPORTANT: explicitly hide on excluded routes — otherwise the
    // banner stays visible from the previous page after client-side
    // navigation into /feed (Sab feedback 2026-04-13).
    if (
      pathname === "/feed" ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/preview/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout")
    ) {
      setVisible(false);
      return;
    }
    // Pro users skip
    if (document.body?.dataset.pro === "1") {
      setVisible(false);
      return;
    }

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
      className="sticky-premium-banner"
    >
      <div className="sticky-premium-banner__inner">
        <Link
          href="/pricing"
          onClick={dismiss}
          className="sticky-premium-banner__link"
        >
          <span className="sticky-premium-banner__icon">✨</span>
          <span className="sticky-premium-banner__text">
            <span className="sticky-premium-banner__title">
              Get iku Premium — 4.99€/mo
            </span>
            <span className="sticky-premium-banner__sub">
              Unlock 38K+ episodes · skip every ad · 4K · cancel anytime
            </span>
          </span>
          <span className="sticky-premium-banner__cta">Upgrade →</span>
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss for 24 hours"
          className="sticky-premium-banner__close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
