"use client";

/**
 * WatchSignupNudge — appears after 30s on /watch for anon users, once per
 * session. Soft CTA that pushes signup ("save to favorites + sync history").
 *
 * Pro and logged-in users never see it. Dismissible. Closeable via Escape
 * or backdrop click.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const SESSION_KEY = "iku-signup-nudge-shown";
const DELAY_MS = 30_000;

export function WatchSignupNudge() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") return;
    try { if (sessionStorage.getItem(SESSION_KEY) === "1") return; } catch { /* */ }

    const t = setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* */ }
    }, DELAY_MS);

    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
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
        <div style={{ fontSize: 32, marginBottom: 10 }}>🌸</div>
        <h2 style={{ fontSize: 20, margin: "0 0 8px", fontWeight: 700 }}>
          Save your favorites
        </h2>
        <p style={{ fontSize: 14, opacity: 0.85, margin: "0 0 20px", lineHeight: 1.5 }}>
          Free account — save videos, keep your watch history across devices, unlock badges.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/signup"
            style={{
              display: "block",
              background: "linear-gradient(90deg, #ff006e 0%, #b5179e 100%)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            Create free account
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
