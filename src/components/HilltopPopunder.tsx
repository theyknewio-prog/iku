"use client";

/**
 * HilltopPopunder — DirectLink popunder, zone 6969665-6969669.
 * Surface #7 of the Playmak3r stack, mounted 2026-05-01.
 *
 * Modern browsers block window.open without a real user gesture, so we
 * arm on the first qualifying click anywhere on the page (not just the
 * play button — the popunder is the page-wide trap, not a button-bound
 * action). Once fired, we set a 24h dismiss flag in localStorage so the
 * same user only gets one popunder per day. Heavier cadence drops fill
 * rate and tanks LTV — Playmak3r's own playbook caps popunders at 1/day.
 *
 * `noopener` is intentionally OMITTED because Hilltop's tracker relies on
 * `window.opener` to attribute the conversion. This is a knowing tradeoff
 * for popunders only; all other outbound links (affiliate sidebar) keep
 * `rel="noopener noreferrer"`.
 *
 * Excluded pages: /feed, /pricing, /checkout, /login, /signup, Pro users.
 * Same exclusion list as IPP — pricing/checkout especially must be popup-
 * free to not torpedo Stripe checkout conversion.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const DISMISS_KEY = "iku-popunder-fired-at";
const DISMISS_HOURS = 24;

const EXCLUDED_PATHS = [
  "/feed",
  "/pricing",
  "/checkout",
  "/login",
  "/signup",
  "/preview",
  "/forgot-password",
  "/reset-password",
];

export function HilltopPopunder() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    )
      return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;

    // Frequency cap: skip if we fired within DISMISS_HOURS.
    try {
      const lastFiredAt = parseInt(
        window.localStorage.getItem(DISMISS_KEY) || "0",
        10,
      );
      const hoursSince = (Date.now() - lastFiredAt) / (1000 * 60 * 60);
      if (hoursSince < DISMISS_HOURS) return;
    } catch {
      // localStorage may be blocked in private mode; fall through and arm anyway.
    }

    let fired = false;
    const onClick = (e: MouseEvent) => {
      if (fired) return;
      const target = e.target as HTMLElement | null;
      // Don't fire on form inputs (login, search, pricing CTAs) or on
      // legitimate action buttons inside dialogs/headers — restrict the
      // arm to clicks landing on plain content (cards, thumbnails, body).
      if (
        target?.closest('input, textarea, select, button[type="submit"]') ||
        target?.closest('[data-no-popunder="1"]')
      )
        return;
      // Only fire if the click is on the main content area (not nav/footer).
      // We don't have a strict marker, so we just fire on any non-form click.
      fired = true;
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      try {
        const w = window.open(
          HILLTOPADS_SCRIPTS.popunderUrl,
          "_blank",
          "noopener=no",
        );
        // True popunder behavior: if we got the window handle, blur it to
        // push the new tab to the background. Most browsers ignore this
        // (foreground tabs), but in some it still works.
        if (w) {
          try {
            w.blur();
            window.focus();
          } catch {
            /* cross-origin can block this */
          }
        }
      } catch {
        /* popup blocked → set dismiss anyway, don't retry on every click */
      }
    };

    // capture: catch the click before any stopPropagation in handlers below.
    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
