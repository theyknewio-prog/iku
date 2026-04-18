"use client";

/**
 * WatchPlayerWithPreroll — Wraps WatchPlayer with pre-roll and post-roll ads.
 *
 * Flow:
 *   1. PrerollAd renders on top of the player (15s, skippable after 5s).
 *   2. Once preroll is done (skipped or timed out), WatchPlayer becomes active.
 *   3. When the video ends (onEnded), PostrollAd is shown for 5 seconds.
 *   4. After postroll, WatchPlayer shows its native "Up Next" countdown.
 *
 * The WatchPlayer is always mounted (for hydration / ISR), but the preroll
 * overlay sits above it until dismissed. The postroll overlay also uses
 * position:absolute inset:0 over the player area.
 *
 * Fix 2026-04-07: The wrapper div now has a guaranteed min-height (56.25vw,
 * i.e. 16:9 ratio, capped at 540px) so that overlay position:absolute has a
 * real bounding box even before the video's natural dimensions are known.
 */

import { useState, useCallback, useMemo } from "react";
import { WatchPlayer } from "./WatchPlayer";
import { VastPrerollAd } from "./VastPrerollAd";
import { PostrollAd } from "./PostrollAd";

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

export function WatchPlayerWithPreroll({
  src,
  poster,
  resolveUrl,
  relatedVideos,
}: Props) {
  const [prerollDone, setPrerollDone] = useState(false);
  const [showPostroll, setShowPostroll] = useState(false);
  const [postrollDone, setPostrollDone] = useState(false);

  // A/B preroll provider 50/50 per mount — stable so the countdown
  // doesn't reset on parent re-renders.
  const provider = useMemo<"exoclick" | "hilltopads">(
    () => (Math.random() < 0.5 ? "exoclick" : "hilltopads"),
    [],
  );

  // Called by WatchPlayer when the video finishes playing
  const handleEnded = useCallback(() => {
    setShowPostroll(true);
  }, []);

  // Called by PostrollAd when it dismisses
  const handlePostrollComplete = useCallback(() => {
    setShowPostroll(false);
    setPostrollDone(true);
  }, []);

  // IMPORTANT: stable reference so PrerollAd's useEffect([finish]) doesn't
  // re-fire on every parent re-render (which would reset the 15s countdown).
  const handlePrerollComplete = useCallback(() => {
    setPrerollDone(true);
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "min(56.25vw, 540px)" }}>
      {/* Pre-roll — real VAST video ad from ExoClick (zone 5893268).
          Fails open on no-fill / timeout so the user is never blocked. */}
      {!prerollDone && (
        <VastPrerollAd onComplete={handlePrerollComplete} provider={provider} />
      )}

      {/* Post-roll — shown as an overlay after the video ends */}
      {showPostroll && !postrollDone && (
        <PostrollAd onComplete={handlePostrollComplete} />
      )}

      <WatchPlayer
        src={src}
        poster={poster}
        resolveUrl={resolveUrl}
        relatedVideos={relatedVideos}
        onVideoEnded={handleEnded}
        suppressEndOverlay={showPostroll && !postrollDone}
        pausedByOverlay={!prerollDone}
      />
    </div>
  );
}
