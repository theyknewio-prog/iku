"use client";

/**
 * WatchSignupNudge — mid-video upsell.
 *
 *   - Anonymous viewer @ 30s  → signup nudge (save favorites, sync history)
 *   - Authenticated non-Pro @ 90s → Pro nudge (skip ads, unlock long-form)
 *
 * One modal per session of each variant. Pro users never see either.
 * Dismiss via Escape / backdrop / "Maybe later".
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const SESSION_KEY_ANON = "iku-signup-nudge-shown";
const SESSION_KEY_PRO = "iku-pro-nudge-shown";
const DELAY_ANON_MS = 30_000;
const DELAY_PRO_MS = 90_000;

type Variant = "signup" | "pro";

export function WatchSignupNudge() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("signup");

  useEffect(() => {
    if (status === "loading") return;

    let variantToShow: Variant;
    let delayMs: number;
    let storageKey: string;

    if (status === "unauthenticated") {
      variantToShow = "signup";
      delayMs = DELAY_ANON_MS;
      storageKey = SESSION_KEY_ANON;
    } else {
      // authenticated — only fire if non-Pro (Pro has data-pro="1")
      if (
        typeof document !== "undefined" &&
        document.body?.dataset.pro === "1"
      ) {
        return;
      }
      variantToShow = "pro";
      delayMs = DELAY_PRO_MS;
      storageKey = SESSION_KEY_PRO;
    }

    try {
      if (sessionStorage.getItem(storageKey) === "1") return;
    } catch {
      /* */
    }

    const t = setTimeout(() => {
      setVariant(variantToShow);
      setOpen(true);
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* */
      }
    }, delayMs);

    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="signup-nudge__backdrop"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(135deg, #1a0924 0%, #2b0b3e 100%)",
          border: "1px solid rgba(255,0,128,0.35)",
          borderRadius: 16,
          padding: "28px 24px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(255,0,128,0.2)",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>
          {variant === "pro" ? "✨" : "🌸"}
        </div>
        <h2 style={{ fontSize: 20, margin: "0 0 8px", fontWeight: 700 }}>
          {variant === "pro"
            ? "Enjoying iku? Skip every ad."
            : "Save your favorites"}
        </h2>
        <p
          style={{
            fontSize: 14,
            opacity: 0.85,
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {variant === "pro"
            ? "Less than a coffee a month. Zero ads, ever. Unlock every long-form episode + 4K."
            : "Free account — save videos, keep your watch history across devices, unlock badges."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={variant === "pro" ? "/pricing" : "/signup"}
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              background:
                variant === "pro"
                  ? "linear-gradient(135deg, #ff3d7a, #8b38ff)"
                  : "linear-gradient(90deg, #ff006e 0%, #b5179e 100%)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            {variant === "pro" ? "Go Premium →" : "Create free account"}
          </Link>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.55)",
              border: "none",
              padding: "8px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
