"use client";

/**
 * MobileNicheBanner — replaces generic ExoClick mobile placements with
 * niche Nutaku affiliate creatives, and injects "sponsored video" cards
 * into the carousel grids (the hentaistream.com Candy-AI trick).
 *
 * What it does:
 *   1. Hides the generic ExoClick 300x50 mobile banners and the 728x90
 *      sticky footer on viewports <768px (they serve cam-girl / dating
 *      creatives that don't convert on a hentai audience).
 *   2. Shows one fixed Nutaku sticky banner above the bottom nav (mobile
 *      only, NOT on /feed which is full-screen Shorts).
 *   3. Injects a `.poster-card` lookalike every 3 cards in each carousel
 *      and every 4 cards in `.hp-video-grid`, linking to Nutaku. Same
 *      DOM structure as real cards so they inherit all site styling.
 *   4. Hides the ExoClick "in-message" popup (#exo-im-container*) that
 *      tries to hijack the page with a 300x250 takeover creative.
 *
 * Pro users don't see any of this (checks data-pro on body).
 *
 * Re-runs on every navigation via usePathname so SPA route changes keep
 * working.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NUTAKU_HREF = "https://www.nutaku.net/home/?af=ikugg";

const NATIVE_CARD_HTML = `
  <div class="poster-card__image">
    <div class="iku-ad__ribbon">AD</div>
    <div class="iku-ad__emoji">🎮</div>
    <div class="iku-ad__cta">▶ PLAY FREE GAMES</div>
  </div>
  <div class="poster-card__info">
    <span class="poster-card__tag">nutaku</span>
    <div class="poster-card__title">Play Free Hentai Games</div>
    <div class="poster-card__meta"><span>★★★★★</span><span>234K plays</span></div>
  </div>
`;

function makeAdCard(): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "poster-card";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.dataset.ikuAd = "1";
  a.innerHTML = NATIVE_CARD_HTML;
  return a;
}

function injectStickyBanner(isFeed: boolean) {
  if (isFeed) return;
  if (window.innerWidth >= 768) return;
  if (document.body.dataset.pro === "1") return;
  if (document.getElementById("iku-niche-link")) return;

  const a = document.createElement("a");
  a.id = "iku-niche-link";
  a.className = "iku-niche-sticky";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.setAttribute("aria-label", "Play free hentai games on Nutaku");
  a.textContent = "▶ Play Free Hentai Games on Nutaku";
  document.body.appendChild(a);
}

function injectNativeAds(isFeed: boolean) {
  if (isFeed) return;
  if (document.body.dataset.pro === "1") return;

  document.querySelectorAll(".carousel-track").forEach((track) => {
    if (track.querySelector('[data-iku-ad="1"]')) return;
    const cards = track.querySelectorAll<HTMLElement>(
      ".poster-card:not([data-iku-ad])"
    );
    if (cards.length < 3) return;
    const ad = makeAdCard();
    cards[2].parentNode?.insertBefore(ad, cards[2]);
  });

  document.querySelectorAll(".hp-video-grid").forEach((grid) => {
    if (grid.querySelector('[data-iku-ad="1"]')) return;
    const cards = grid.querySelectorAll<HTMLElement>(
      ".poster-card:not([data-iku-ad]),.hp-hero-play-card"
    );
    if (cards.length < 4) return;
    const ad = makeAdCard();
    cards[3].parentNode?.insertBefore(ad, cards[3]);
  });
}

export function MobileNicheBanner() {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  useEffect(() => {
    document.body.classList.toggle("iku-feed", isFeed);
  }, [isFeed]);

  useEffect(() => {
    if (isFeed) {
      // On feed: strip any previously-injected elements from other routes
      document.getElementById("iku-niche-link")?.remove();
      document
        .querySelectorAll('[data-iku-ad="1"]')
        .forEach((el) => el.remove());
      return;
    }

    const tick = () => {
      injectStickyBanner(isFeed);
      injectNativeAds(isFeed);
    };

    // First run shortly after mount (grids may still be rendering)
    const initial = setTimeout(tick, 150);
    // Re-run every 2s so SPA transitions and late-loading grids are caught
    const interval = setInterval(tick, 2000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [isFeed]);

  // The injected nodes are added imperatively in useEffect — this component
  // only renders the global <style> tag. Kept outside the effect so the CSS
  // is in the SSR output (no flash of generic ads before hydration).
  return (
    <style
      id="iku-niche-style"
      dangerouslySetInnerHTML={{
        __html: `
          /* Kill ExoClick in-message / in-page popups site-wide.
             These are 300x250 cam-girl takeovers that aren't in our plan. */
          [id^="exo-im-container"],
          [id^="exo-native-widget"],
          [class*="exo-im-popup"] {
            display: none !important;
            visibility: hidden !important;
          }

          /* Hide generic mobile ExoClick placements — they serve AI
             girlfriend / dating / cam creatives that don't match the
             hentai audience. Replaced below with Nutaku native ads. */
          @media (max-width: 767px) {
            .sticky-footer-ad,
            .sticky-footer-ad__zone,
            .ad-zone--300x50,
            .ad-zone--above-player {
              display: none !important;
              visibility: hidden !important;
            }

            .iku-niche-sticky {
              position: fixed;
              bottom: 66px;
              left: 8px;
              right: 8px;
              height: 48px;
              z-index: 40;
              background: linear-gradient(90deg, #ff006e 0%, #8338ec 100%);
              color: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              font-weight: 700;
              font-size: 13px;
              text-decoration: none;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(255, 0, 110, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              animation: ikuNicheFade 0.5s ease both;
            }

            .iku-feed .iku-niche-sticky { display: none !important; }
          }

          @media (min-width: 768px) {
            .iku-niche-sticky { display: none !important; }
          }

          @keyframes ikuNicheFade {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: none; }
          }

          /* Native ad card — clones .poster-card structure, swaps the
             image for a pure gradient + ribbon + CTA. Hidden on /feed. */
          .poster-card[data-iku-ad="1"] {
            cursor: pointer;
          }
          .poster-card[data-iku-ad="1"] .poster-card__image {
            background: linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%) !important;
            position: relative;
            overflow: hidden;
          }
          .poster-card[data-iku-ad="1"] .poster-card__image::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3), transparent 50%),
              radial-gradient(circle at 70% 80%, rgba(255,255,255,0.18), transparent 45%);
            pointer-events: none;
          }
          .poster-card[data-iku-ad="1"] .iku-ad__emoji {
            position: absolute;
            top: 42%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 52px;
            z-index: 2;
            filter: drop-shadow(0 4px 14px rgba(0,0,0,0.5));
          }
          .poster-card[data-iku-ad="1"] .iku-ad__ribbon {
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 3;
            background: rgba(0,0,0,0.78);
            color: #fff;
            font-size: 9px;
            font-weight: 800;
            padding: 3px 7px;
            border-radius: 4px;
            letter-spacing: 0.6px;
          }
          .poster-card[data-iku-ad="1"] .iku-ad__cta {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            z-index: 3;
            background: rgba(255,255,255,0.97);
            color: #ff006e;
            font-size: 10px;
            font-weight: 800;
            padding: 5px 8px;
            border-radius: 5px;
            text-align: center;
            letter-spacing: 0.3px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            white-space: nowrap;
          }
          .poster-card[data-iku-ad="1"] .poster-card__tag {
            background: linear-gradient(135deg, #ff006e, #8338ec) !important;
            color: #fff !important;
          }
          .iku-feed .poster-card[data-iku-ad="1"] { display: none !important; }
        `,
      }}
    />
  );
}
