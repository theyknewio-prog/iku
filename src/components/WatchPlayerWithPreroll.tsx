"use client";

/**
 * WatchPlayerWithPreroll — Wraps WatchPlayer with a pre-roll ad overlay.
 *
 * The PrerollAd renders on top of the player area. Once the ad completes
 * (or is skipped / fails to load), it dismisses and the WatchPlayer is
 * revealed. The WatchPlayer is always mounted (for SEO/hydration), but
 * the preroll covers it until done.
 */

import { useState } from "react";
import { WatchPlayer } from "./WatchPlayer";
import { PrerollAd } from "./PrerollAd";

interface RelatedVideo {
  slug: string;
  thumbnail: string;
  title: string;
}

interface Props {
  src: string;
  poster?: string;
  resolveUrl?: string;
  relatedVideos?: RelatedVideo[];
}

export function WatchPlayerWithPreroll({ src, poster, resolveUrl, relatedVideos }: Props) {
  const [prerollDone, setPrerollDone] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {!prerollDone && (
        <PrerollAd onComplete={() => setPrerollDone(true)} />
      )}
      <WatchPlayer
        src={src}
        poster={poster}
        resolveUrl={resolveUrl}
        relatedVideos={relatedVideos}
      />
    </div>
  );
}
