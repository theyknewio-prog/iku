"use client";

/**
 * MobileNicheBanner — replaces the generic ExoClick 300x50 + 728x90 mobile
 * sticky placements with a direct Nutaku affiliate banner ciblé hentai.
 *
 * Why: ExoClick's default fill on those slots is 95% generic adult traffic
 * (AI girlfriend apps, live cam girls, dating) that converts near zero on
 * a hentai/anime audience. Until we have a rotation of niche creatives
 * from CrakRevenue hentai vertical + Nutaku + FAKKU affiliates, we show
 * a single high-intent niche banner (Nutaku hentai games) on mobile, and
 * hide the generic ExoClick 300x50 placements + the 728x90 sticky footer.
 *
 * Pro users don't see this (checks data-pro on body, same convention as
 * other ad components).
 */

import { useEffect, useState } from "react";

const NUTAKU_HREF = "https://www.nutaku.net/home/?af=ikugg";
const STORAGE_KEY = "iku_niche_sticky_dismissed";

export function MobileNicheBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (document.body.dataset.pro === "1") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    if (window.innerWidth >= 768) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .sticky-footer-ad, .ad-zone--300x50, .ad-zone--above-player, .sticky-footer-ad__zone {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
      <a
        className="iku-niche-sticky"
        href={NUTAKU_HREF}
        target="_blank"
        rel="sponsored nofollow noopener"
        aria-label="Play free hentai games on Nutaku"
        style={{
          position: "fixed",
          bottom: 66,
          left: 8,
          right: 8,
          height: 48,
          zIndex: 40,
          background: "linear-gradient(90deg, #ff006e 0%, #8338ec 100%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
          borderRadius: 8,
          boxShadow: "0 4px 20px rgba(255, 0, 110, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          animation: "ikuNicheFade 0.5s ease both",
        }}
      >
        ▶ Play Free Hentai Games on Nutaku
      </a>
      <style>{`
        @keyframes ikuNicheFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @media (min-width: 768px) {
          .iku-niche-sticky { display: none !important; }
        }
      `}</style>
    </>
  );
}
