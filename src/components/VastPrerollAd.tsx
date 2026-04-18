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

type Props = { onComplete: () => void };

const LOAD_TIMEOUT_MS = 3000;

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

export function VastPrerollAd({ onComplete }: Props) {
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
    }, LOAD_TIMEOUT_MS);

    fetch("/api/vast", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok: boolean } & VastAd) => {
        if (cancelled) return;
        if (!data.ok) {
          setDone(true);
          completeRef.current();
          return;
        }
        setAd(data);
        setRemaining(data.duration || 15);
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
  }, [onComplete, started]);

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
  if (!ad) {
    // Loading shim — dark placeholder matching player aspect.
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
          fontSize: 13,
          zIndex: 10,
        }}
      >
        Loading ad…
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
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
        }}
      />

      {/* Top-left: "Ad" label */}
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

      {/* Unmute hint */}
      {muted && (
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
          miss it over the ad creative's own CTA. */}
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
    </div>
  );
}
