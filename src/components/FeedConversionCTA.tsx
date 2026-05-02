"use client";

/**
 * FeedConversionCTA — fullscreen overlay shown between Shorts feed
 * swipes that pushes a conversion CTA instead of an ad.
 *
 * Two variants:
 *   - "signup"  — Sign up free, listing the free-tier perks.
 *                 Hidden if the user is already logged in.
 *   - "premium" — Upgrade to Premium, listing the paid-tier perks.
 *                 Always shown to non-Pro users.
 *
 * Caller (SwipeFeed) decides which variant + when to show. Pro users
 * never see this. Same close-button-after-3s pattern as the previous
 * FeedInterstitial so muscle memory carries over.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const CLOSE_DELAY = 3000;

type Variant = "signup" | "premium";

interface Props {
  variant: Variant;
  onClose: () => void;
}

export function FeedConversionCTA({ variant, onClose }: Props) {
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCanClose(true), CLOSE_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const config =
    variant === "signup"
      ? {
          eyebrow: "Free account",
          icon: "✨",
          title: "Save what you love",
          sub: "Create a free iku.gg account in 10 seconds.",
          perks: [
            "❤️ Unlimited favorites & history",
            "🏷️ Follow your top characters & series",
            "🎯 Personalized feed",
            "💎 Earn badges + Discord access",
          ],
          cta: "Sign up free",
          ctaHref: "/signup",
          secondary: "Already have an account? Sign in",
          secondaryHref: "/login",
          gradient: "linear-gradient(135deg, #00aff0 0%, #8b38ff 100%)",
        }
      : {
          eyebrow: "iku Premium",
          icon: "💎",
          title: "Get the most out of iku.",
          sub: "4K when available, 48h early access, unlimited favorites, Pro Discord.",
          perks: [
            "🎬 4K when available",
            "⚡ 48h early access on new uploads",
            "❤️ Unlimited favorites + playlists",
            "🎮 Pro-only Discord channel",
          ],
          cta: "Get Premium — 4.99€/mo",
          ctaHref: "/pricing",
          secondary: "Save 33% with yearly →",
          secondaryHref: "/pricing",
          gradient:
            "linear-gradient(135deg, #ff3d7a 0%, #8b38ff 60%, #ffbe0b 100%)",
        };

  return (
    <div
      className="feed-interstitial"
      aria-label={variant === "signup" ? "Sign up CTA" : "Premium CTA"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#0e0a18",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "28px 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient halo */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -80,
            left: -40,
            right: -40,
            height: 200,
            background: config.gradient,
            opacity: 0.4,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            color: "#fff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {config.eyebrow}
          </div>

          <div style={{ fontSize: 42, marginBottom: 10 }}>{config.icon}</div>

          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
              lineHeight: 1.15,
            }}
          >
            {config.title}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              margin: "0 0 22px",
              lineHeight: 1.45,
            }}
          >
            {config.sub}
          </p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 24px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {config.perks.map((p) => (
              <li
                key={p}
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.85)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {p}
              </li>
            ))}
          </ul>

          <Link
            href={config.ctaHref}
            onClick={onClose}
            style={{
              display: "block",
              padding: "13px 18px",
              borderRadius: 12,
              background: config.gradient,
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(139,56,255,0.4)",
              marginBottom: 12,
            }}
          >
            {config.cta}
          </Link>

          <Link
            href={config.secondaryHref}
            onClick={onClose}
            style={{
              display: "block",
              fontSize: 12,
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
            }}
          >
            {config.secondary}
          </Link>
        </div>
      </div>

      {canClose ? (
        <button
          className="feed-interstitial__close"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            fontWeight: 600,
            zIndex: 10000,
          }}
        >
          {Math.ceil(CLOSE_DELAY / 1000)}s
        </div>
      )}
    </div>
  );
}
