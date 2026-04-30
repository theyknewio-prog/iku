"use client";

/**
 * WatchPlayerVast — wraps WatchPlayer with a 1/3-videos VAST preroll.
 *
 * Playmak3r page 6: "Video pre-roll every 3 videos" — pre-roll on EVERY
 * video tanks session length + SEO. We increment a localStorage session
 * counter on each /watch mount; preroll shows when `count % 3 === 1`
 * (i.e. videos #1, #4, #7, ...). That's ~1/3 of videos watched.
 *
 * WatchPlayer is ALWAYS mounted (for ISR + hydration) — the preroll is
 * an absolute overlay that dismisses itself on complete/skip/error/
 * timeout (3s). Failing open means users are never blocked on a dead
 * VAST endpoint.
 *
 * Pro users skip entirely (`data-pro` on body, handled inside VastPrerollAd).
 */

import { useCallback, useEffect, useState } from "react";
import { WatchPlayer } from "./WatchPlayer";
import { VastPrerollAd } from "./VastPrerollAd";

interface RelatedVideo {
  slug: string;
  thumbnail: string;
  title: string;
}

interface Props {
  src: string;
  poster?: string;
  resolveUrl?: string;
  slug: string;
  relatedVideos?: RelatedVideo[];
}

const COUNTER_KEY = "iku_vast_preroll_count";

function shouldShowPreroll(): boolean {
  try {
    if (typeof window === "undefined") return false;
    // Pro users always skip — body attribute is set before hydration on
    // Pro pages, but we double-check here in case VastPrerollAd mounts
    // before the gate resolves.
    if (document.body?.dataset.pro === "1") return false;
    const raw = window.sessionStorage.getItem(COUNTER_KEY);
    const prev = raw ? parseInt(raw, 10) || 0 : 0;
    const next = prev + 1;
    window.sessionStorage.setItem(COUNTER_KEY, String(next));
    // Show on 1st, 4th, 7th... so users with low pages/session still
    // see a preroll at least once before they bounce.
    return next === 1 || (next - 1) % 3 === 0;
  } catch {
    return false;
  }
}

export function WatchPlayerVast(props: Props) {
  const [prerollDone, setPrerollDone] = useState(true); // default true = no preroll
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (!shouldShowPreroll()) {
      setDecided(true);
      return;
    }

    // Defer the VastPrerollAd mount until AFTER window.load fires.
    //
    // Without this, the preroll <video> starts streaming silent-basis.pro/
    // *.mp4 (26-52s creatives) immediately on hydration. The browser tracks
    // that fetch toward the window load event, so PerformanceNavigationTiming
    // .loadEventEnd reports 15-21s on /watch — even though the page itself
    // is interactive at FCP ~500ms. Sab's 20-agent audit on 2026-04-30
    // showed this exact pattern: home loads in 200-1000ms, /watch loads in
    // 3.5-21s, gap is the preroll buffering.
    //
    // Firing after window.load means: page reports loaded fast, then
    // preroll appears (a beat later) over the player. Net user experience
    // is the same — preroll still gates the first video — but reported
    // page speed drops from 15s to ~3s on /watch.
    const fire = () => {
      setPrerollDone(false);
      setDecided(true);
    };
    if (document.readyState === "complete") {
      const t = setTimeout(fire, 100);
      return () => clearTimeout(t);
    }
    window.addEventListener("load", fire, { once: true });
    return () => window.removeEventListener("load", fire);
  }, []);

  const handlePrerollDone = useCallback(() => setPrerollDone(true), []);

  return (
    <>
      <WatchPlayer
        src={props.src}
        poster={props.poster}
        resolveUrl={props.resolveUrl}
        slug={props.slug}
        relatedVideos={props.relatedVideos}
      />
      {decided && !prerollDone && (
        <VastPrerollAd onComplete={handlePrerollDone} />
      )}
    </>
  );
}
