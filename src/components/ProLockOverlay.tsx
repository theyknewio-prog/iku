"use client";

/**
 * ProLockOverlay — replaces the video player for Pro-gated content
 * when the viewer doesn't have an active subscription.
 *
 * Two unlock paths for free users:
 *   1. Subscribe to iku Premium (4.99€/mo) — unlocks every episode site-wide
 *   2. Spend gamification points (per-video, persistent) — alternative for
 *      free users who grind via views/favorites/quests
 *
 * If the viewer is signed in and has enough points, the "Unlock with X points"
 * button calls /api/unlock-video to deduct + persist. On success the parent
 * re-fetches /api/pro-status which now returns unlockedThisVideo=true and
 * the player swaps in.
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  thumbnail: string | null;
  title: string;
  signedIn: boolean;
  /** Optional points-unlock context. When videoPk + cost are provided
   *  AND the user is signed in, render the alternative "spend points" CTA. */
  videoPk?: number;
  unlockCost?: number;
  userScore?: number;
  onUnlocked?: () => void;
};

export function ProLockOverlay({
  thumbnail,
  title,
  signedIn,
  videoPk,
  unlockCost,
  userScore,
  onUnlocked,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canShowPointsCta =
    signedIn &&
    typeof videoPk === "number" &&
    typeof unlockCost === "number" &&
    typeof userScore === "number";

  const hasEnoughPoints =
    canShowPointsCta && (userScore ?? 0) >= (unlockCost ?? Infinity);

  async function handlePointsUnlock() {
    if (!videoPk) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/unlock-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPk }),
      });
      const data = await r.json();
      if (data.ok) {
        onUnlocked?.();
      } else if (data.reason === "insufficient") {
        setError(`Need ${data.needed} pts, you have ${data.have}.`);
      } else {
        setError("Unlock failed. Try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        background: "#000",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {thumbnail && (
        <Image
          src={thumbnail}
          alt=""
          fill
          unoptimized
          style={{ objectFit: "cover", filter: "blur(32px) brightness(0.4)", transform: "scale(1.15)" }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          textAlign: "center",
          color: "#fff",
          background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            marginBottom: 14,
          }}
        >
          🔒
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#ffb370",
            marginBottom: 8,
          }}
        >
          iku Premium · Full episode
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            margin: "0 0 6px",
            maxWidth: 520,
            lineHeight: 1.25,
          }}
        >
          Unlock the full episode
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 480,
            margin: "0 0 18px",
            lineHeight: 1.45,
          }}
        >
          {title.slice(0, 110)} — plus every other full-length episode on iku.gg.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing"
            style={{
              background: "linear-gradient(135deg, #ff7a00 0%, #ff3b00 100%)",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 6px 22px rgba(255,122,0,0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ✨ Premium — 4.99€/mo
          </Link>
          {canShowPointsCta && (
            <button
              onClick={handlePointsUnlock}
              disabled={busy || !hasEnoughPoints}
              style={{
                background: hasEnoughPoints
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${hasEnoughPoints ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}`,
                color: hasEnoughPoints ? "#fff" : "rgba(255,255,255,0.4)",
                padding: "12px 22px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                cursor: hasEnoughPoints && !busy ? "pointer" : "default",
              }}
            >
              {busy ? "Unlocking…" : `🪙 Unlock with ${unlockCost} pts (you: ${userScore})`}
            </button>
          )}
          {!signedIn && (
            <Link
              href="/login"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff",
                padding: "12px 20px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 14, fontSize: 12, color: "#ff9999" }}>{error}</div>
        )}

        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span>✓ Every full episode unlocked</span>
          <span>✓ No ads</span>
          <span>✓ 4K when available</span>
        </div>
        {!signedIn && (
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            Or sign up free to earn unlock points by watching, favoriting, and completing daily quests.
          </div>
        )}
      </div>
    </div>
  );
}
