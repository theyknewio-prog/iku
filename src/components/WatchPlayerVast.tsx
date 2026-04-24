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
    if (shouldShowPreroll()) {
      setPrerollDone(false);
    }
    setDecided(true);
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
