"use client";

/**
 * AdsterraPopunder — Adsterra Popunder_1 (placement 28986138) via direct URL.
 *
 * We drive the trigger ourselves instead of loading Adsterra's popunder
 * script: on the visitor's FIRST click anywhere, open the direct link in a
 * new tab. Owning the trigger means the 1-per-session cap is enforced by
 * us (their script's frequency capping relies on its own cookies which
 * adblockers strip). Direct URL = top-level navigation, no CSP surface.
 *
 * Placement history: best eCPM ever measured on this site ($0.469 vs
 * $0.008-0.03 for display banners, Adsterra all-time stats 2026-04).
 *
 * Guards: Pro users, /feed (Shorts stay ad-free — owner decision),
 * 1 fire max per 12h per browser (localStorage), bots don't click.
 */

import { useEffect } from "react";

const POP_URL =
  "https://www.effectivecpmnetwork.com/hqzxb0he?key=3ac5c557ed669544ce272e344486c7d0";
const CAP_KEY = "iku_pop_ts";
const CAP_MS = 12 * 60 * 60 * 1000; // 12h — aligns with ExoClick's 720min norm

export function AdsterraPopunder() {
  useEffect(() => {
    if (document.body?.dataset.pro === "1") return;
    if (window.location.pathname.startsWith("/feed")) return;
    try {
      const last = Number(localStorage.getItem(CAP_KEY) || 0);
      if (Date.now() - last < CAP_MS) return;
    } catch {
      return; // storage blocked → can't cap → don't fire at all
    }

    const onClick = (e: MouseEvent) => {
      // Never piggyback on an affiliate click — the /go/ redirect is worth
      // more than the pop, and two tabs at once kills both conversions.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('a[href^="/go/"]')) return; // stay armed
      try {
        const last = Number(localStorage.getItem(CAP_KEY) || 0);
        if (Date.now() - last < CAP_MS) return;
        localStorage.setItem(CAP_KEY, String(Date.now()));
      } catch {
        return;
      }
      document.removeEventListener("click", onClick, { capture: true });
      window.open(POP_URL, "_blank", "noopener,noreferrer");
    };

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
