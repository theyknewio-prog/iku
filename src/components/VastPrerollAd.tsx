"use client";

/**
 * VastPrerollAd — real video pre-roll via VAST.
 *
 * Fetches the parsed VAST from our /api/vast proxy (CORS-safe), plays
 * the MediaFile in a muted-autoplay `<video>` overlay above the main
 * player, fires impression + quartile + complete pixels, and exposes
 * a skip button after `skipOffset` seconds (defaults to 5s).
 *
 * Fails open: on any error (no fill, timeout, parse fail, <video> load
 * error) we call onComplete immediately so the user isn't blocked.
 *
 * Pro users skip entirely — detected via `data-pro` on <body>.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type VastAd = {
  mediaUrl: string;
  duration: number;
  skipOffset: number;
  clickThrough: string;
  impressions: string[];
  tracking: Record<string, string[]>;
};

type Props = {
  onComplete: () => void;
  provider?: "exoclick" | "hilltopads";
};

const MIN_SKIP_OFFSET = 10;

// How long we wait for /api/vast to return a parsed ad. Measured from
// production 2026-04-18: ExoClick warm 1.2s / cold 2.7s, HilltopAds warm
// 3.8s / cold up to 28s. At 2.5s we were failing open on ~70% of the
// HilltopAds bias → zero preroll 70% of the time. 8s catches the normal
// case while still failing open on the rare cold CDN stall. During the
// wait the main video is paused behind a transparent overlay so the user
// sees the thumbnail (poster), not a black screen.
const VAST_FETCH_TIMEOUT_MS = 8000;

// How long we wait for the <video> element to actually start playing
// after we've set `ad`. If the creative buffers too long or errors we
// fail open. Prevents the "black screen then cut" the user reported.
const PLAYBACK_START_TIMEOUT_MS = 4000;

function firePixels(urls: string[] | undefined) {
  if (!urls || urls.length === 0) return;
  for (const u of urls) {
    try {
      const img = new Image();
      img.src = u;
    } catch {
      /* noop */
    }
  }
}

export function VastPrerollAd({ onComplete, provider = "exoclick" }: Props) {
  const [ad, setAd] = useState<VastAd | null>(null);
  const [started, setStarted] = useState(false);
  const [skipArmed, setSkipArmed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [remaining, setRemaining] = useState(15);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const completeRef = useRef<() => void>(() => {});
  completeRef.current = onComplete;

  // Fetch parsed VAST
  useEffect(() => {
    // Pro users skip entirely
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1") {
      setDone(true);
      onComplete();
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled || started) return;
      // No response in time = fail open
      setDone(true);
      completeRef.current();
    }, VAST_FETCH_TIMEOUT_MS);

    fetch(`/api/vast?provider=${provider}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok: boolean } & VastAd) => {
        if (cancelled) return;
        if (!data.ok) {
          setDone(true);
          completeRef.current();
          return;
        }
        // Force a minimum skip delay so users can't skip in 3–5s
        // (which hurts fill rate and our ad revenue).
        const patched: VastAd = {
          ...data,
          skipOffset: Math.max(MIN_SKIP_OFFSET, data.skipOffset || 0),
        };
        setAd(patched);
        setRemaining(patched.duration || 15);
      })
      .catch(() => {
        if (cancelled) return;
        setDone(true);
        completeRef.current();
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [onComplete, started, provider]);

  const fireOnce = useCallback((key: string, urls?: string[]) => {
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);
    firePixels(urls);
  }, []);

  // Quartile tracking
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current || !ad) return;
    const t = videoRef.current.currentTime;
    const d = videoRef.current.duration || ad.duration;
    setRemaining(Math.max(0, Math.ceil(d - t)));
    setElapsed(t);
    if (t >= ad.skipOffset && !skipArmed) setSkipArmed(true);
    if (d > 0) {
      const q = t / d;
      if (q >= 0.25) fireOnce("q1", ad.tracking.firstQuartile);
      if (q >= 0.5) fireOnce("q2", ad.tracking.midpoint);
      if (q >= 0.75) fireOnce("q3", ad.tracking.thirdQuartile);
    }
  }, [ad, skipArmed, fireOnce]);

  const handlePlay = useCallback(() => {
    if (!ad || started) return;
    setStarted(true);
    fireOnce("imp", ad.impressions);
    fireOnce("start", ad.tracking.start);
  }, [ad, started, fireOnce]);

  // Playback-start watchdog: once we have an `ad`, we expect the <video>
  // to fire `onPlay` within PLAYBACK_START_TIMEOUT_MS. If it doesn't
  // (e.g. creative stuck buffering, network blip), we fail open so the
  // user isn't stuck on a black overlay.
  useEffect(() => {
    if (!ad || started || done) return;
    const id = setTimeout(() => {
      if (!started && !done) {
        setDone(true);
        completeRef.current();
      }
    }, PLAYBACK_START_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [ad, started, done]);

  const handleEnded = useCallback(() => {
    if (!ad) return;
    fireOnce("complete", ad.tracking.complete);
    setDone(true);
    onComplete();
  }, [ad, fireOnce, onComplete]);

  const handleError = useCallback(() => {
    setDone(true);
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    if (!ad || !skipArmed) return;
    fireOnce("skip", ad.tracking.skip);
    setDone(true);
    onComplete();
  }, [ad, skipArmed, fireOnce, onComplete]);

  const handleClick = useCallback(() => {
    if (!ad?.clickThrough) return;
    fireOnce("click", ad.tracking.click);
    window.open(ad.clickThrough, "_blank", "noopener,noreferrer");
  }, [ad, fireOnce]);

  const handleUnmute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
  }, []);

  if (done) return null;
  // While /api/vast is in flight OR the <video> hasn't fired onPlay yet,
  // render an invisible overlay (no black background, no "Loading ad…"
  // text). The main player sits behind — pausedByOverlay keeps it from
  // playing underneath. This avoids the 1-3s of opaque black the user
  // complained about before the creative actually starts.
  if (!ad) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          zIndex: 10,
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Black background ONLY once playback has started, to avoid the
        // user seeing opaque black while the creative buffers. Before
        // that the overlay is transparent — the main player behind is
        // already paused (pausedByOverlay) so there's nothing to hide.
        background: started ? "#000" : "transparent",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        src={ad.mediaUrl}
        autoPlay
        muted
        playsInline
        preload="auto"
        onPlay={handlePlay}
        onTimeUpdate={onTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        onClick={handleClick}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: ad.clickThrough ? "pointer" : "default",
          // Keep <video> invisible until it's actually rolling — same
          // reason as the wrapper bg above.
          visibility: started ? "visible" : "hidden",
        }}
      />

      {/* Top-left: "Ad" label — only after playback started */}
      {started && (
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "3px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          Ad · {remaining}s
        </div>
      )}

      {/* Unmute hint */}
      {started && muted && (
        <button
          onClick={handleUnmute}
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          🔇 Tap to unmute
        </button>
      )}

      {/* Skip button — pill, high contrast when armed so mobile users don't
          miss it over the ad creative's own CTA. Hidden until playback
          begins so it doesn't float over a transparent overlay. */}
      {started && (
        <button
          onClick={handleSkip}
          disabled={!skipArmed}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            background: skipArmed ? "#fff" : "rgba(0,0,0,0.72)",
            color: skipArmed ? "#000" : "#fff",
            border: skipArmed ? "none" : "1px solid rgba(255,255,255,0.28)",
            padding: "12px 20px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.01em",
            cursor: skipArmed ? "pointer" : "default",
            opacity: skipArmed ? 1 : 0.9,
            boxShadow: skipArmed ? "0 6px 18px rgba(0,0,0,0.5)" : "none",
            minWidth: 118,
            zIndex: 15,
          }}
        >
          {skipArmed
            ? "Skip Ad ▶"
            : `Skip in ${Math.max(0, Math.ceil(ad.skipOffset - elapsed))}s`}
        </button>
      )}
    </div>
  );
}
