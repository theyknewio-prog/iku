"use client";

/**
 * VastPrerollAd — real video pre-roll via VAST (HilltopAds zone 6969713).
 *
 * Fetches the parsed VAST from our /api/vast?provider=hilltopads proxy,
 * plays the MediaFile in a muted-autoplay `<video>` overlay above the
 * main player, fires impression + quartile + complete pixels, exposes a
 * skip button after `skipOffset` seconds (defaults to 5s), and shows a
 * Premium nudge once per session on skip click.
 *
 * Fails open: any error (no fill, timeout, parse fail, <video> load
 * error) calls onComplete immediately so the user isn't blocked.
 *
 * Pro users skip entirely — detected via `data-pro` on <body>.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

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
  const [done, setDone] = useState(false);
  const [showSkipNudge, setShowSkipNudge] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const completeRef = useRef<() => void>(() => {});
  completeRef.current = onComplete;

  useEffect(() => {
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1") {
      setDone(true);
      onComplete();
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled || started) return;
      setDone(true);
      completeRef.current();
    }, LOAD_TIMEOUT_MS);

    fetch("/api/vast?provider=hilltopads", { cache: "no-store" })
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

  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current || !ad) return;
    const t = videoRef.current.currentTime;
    const d = videoRef.current.duration || ad.duration;
    setRemaining(Math.max(0, Math.ceil(d - t)));
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
    try {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "_";
      const key = `iku-skip-nudge-${path}`;
      const seen = sessionStorage.getItem(key);
      const isPro = document.body?.dataset.pro === "1";
      if (!seen && !isPro) {
        sessionStorage.setItem(key, "1");
        setShowSkipNudge(true);
        return;
      }
    } catch {
      /* sessionStorage may be blocked */
    }
    setDone(true);
    onComplete();
  }, [ad, skipArmed, fireOnce, onComplete]);

  const dismissNudge = useCallback(() => {
    setShowSkipNudge(false);
    setDone(true);
    onComplete();
  }, [onComplete]);

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

      {showSkipNudge && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 20,
          }}
        >
          <div
            style={{
              maxWidth: 360,
              background: "#0e0a18",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "26px 22px",
              textAlign: "center",
              color: "#fff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -60,
                left: -30,
                right: -30,
                height: 160,
                background:
                  "linear-gradient(135deg, #ff3d7a, #8b38ff, #ffbe0b)",
                opacity: 0.4,
                filter: "blur(50px)",
              }}
            />
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⏭️</div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  margin: "0 0 6px",
                  letterSpacing: "-0.01em",
                }}
              >
                Skip ads forever
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.75)",
                  margin: "0 0 18px",
                  lineHeight: 1.45,
                }}
              >
                Less than a coffee a month. Zero ads, ever. Unlock every
                long-form episode.
              </p>
              <Link
                href="/pricing"
                onClick={dismissNudge}
                style={{
                  display: "block",
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #ff3d7a, #8b38ff)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                  marginBottom: 10,
                }}
              >
                Get Premium →
              </Link>
              <button
                onClick={dismissNudge}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "6px 12px",
                }}
              >
                No thanks, continue
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSkip}
        disabled={!skipArmed}
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          background: skipArmed ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.55)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          padding: "8px 14px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          cursor: skipArmed ? "pointer" : "default",
          opacity: skipArmed ? 1 : 0.7,
        }}
      >
        {skipArmed
          ? "Skip Ad ▶"
          : `Skip in ${Math.max(0, ad.skipOffset - (15 - remaining))}s`}
      </button>
    </div>
  );
}
