/**
 * ProLockOverlay — replaces the video player for Pro-gated content
 * when the viewer doesn't have an active subscription.
 *
 * Visual language stolen from OnlyFans post-lock + Fansly: blurred
 * thumbnail behind, lock icon center, price CTA.
 */

import Link from "next/link";
import Image from "next/image";

type Props = {
  thumbnail: string | null;
  title: string;
  signedIn: boolean;
};

export function ProLockOverlay({ thumbnail, title, signedIn }: Props) {
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
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            marginBottom: 18,
          }}
        >
          🔒
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#ffb370",
            marginBottom: 10,
          }}
        >
          iku Pro · Premium episode
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            margin: "0 0 8px",
            maxWidth: 520,
            lineHeight: 1.25,
          }}
        >
          Subscribe to unlock the full episode
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 480,
            margin: "0 0 22px",
            lineHeight: 1.5,
          }}
        >
          {title.slice(0, 110)} — plus every other full-length episode on
          iku.gg. Cancel anytime.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing"
            style={{
              background: "linear-gradient(135deg, #ff7a00 0%, #ff3b00 100%)",
              color: "#fff",
              padding: "13px 28px",
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
            ✨ Unlock for 4.99€/mo
          </Link>
          {!signedIn && (
            <Link
              href="/login"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff",
                padding: "13px 22px",
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

        <div
          style={{
            marginTop: 22,
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span>✓ Every full episode unlocked</span>
          <span>✓ No ads</span>
          <span>✓ 4K when available</span>
        </div>
      </div>
    </div>
  );
}
