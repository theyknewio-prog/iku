"use client";

/**
 * MobileNicheBanner — full v6 ad stack:
 *   1. Mobile sticky Nutaku banner (fixed bottom, above nav, not on /feed)
 *   2. Mobile top banner (gradient card, right under header)
 *   3. Mobile mid interstitial (between carousel sections)
 *   4. Native ad poster-card clones in every .carousel-track (pos 3 + 7)
 *      and .hp-video-grid (pos 4 + 8)
 *   5. Square banners after every 2nd h2/h3 on any page (sections, related,
 *      watch info, etc.)
 *   6. Corner floating 🎮 PLAY FREE ad (bottom-right, closable)
 *   7. Pro upsell modal triggered when a user closes an ad → /pricing
 *   8. Watch page native video-card ads (.video-grid) at positions 3/7/11
 *   9. Kills ExoClick in-message / popup formats site-wide
 *
 * Rationale: ExoClick's generic adult fill (cam girl, AI girlfriend, dating)
 * converts near zero on a hentai audience. Every placement here is Nutaku
 * affiliate (?af=ikugg), on-brand, and drives either direct CPA revenue or
 * Pro conversions via the close-modal flywheel.
 *
 * All placements are MOBILE ONLY (>=768px hides everything), hidden on
 * /feed (Shorts full-screen UI), and hidden for Pro users.
 *
 * Patterned after hentaigasm + hentaicity competitor density (~18 placements
 * on their homepage). See memory/project_session_2026_04_10_night.md +
 * reference_ad_network_research_2026_04_10.md for the why.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NUTAKU_HREF = "https://www.nutaku.net/home/?af=ikugg";

// ── Ad creative variants — rotated across native cards ─────────────

interface CardVariant {
  emoji: string;
  title: string;
  plays: string;
  cta: string;
}

const CARD_VARIANTS: CardVariant[] = [
  { emoji: "🎮", title: "Play Free Hentai Games", plays: "234K plays", cta: "PLAY FREE" },
  { emoji: "🔥", title: "Hentai Games — Uncensored", plays: "189K plays", cta: "PLAY NOW" },
  { emoji: "💋", title: "Build Your Anime Harem", plays: "312K plays", cta: "START FREE" },
  { emoji: "⚔️", title: "Top Hentai RPGs 2026", plays: "156K plays", cta: "PLAY FREE" },
  { emoji: "🤍", title: "Waifu Dating Simulator", plays: "421K plays", cta: "MEET NOW" },
  { emoji: "🎯", title: "Hentai Visual Novels", plays: "278K plays", cta: "READ FREE" },
];

interface SquareVariant {
  emoji: string;
  tag: string;
  title: string;
  sub: string;
}

const SQUARE_VARIANTS: SquareVariant[] = [
  { emoji: "🔥", tag: "NUTAKU", title: "400+ Free Hentai Games", sub: "Uncensored VN, RPGs, dating sims" },
  { emoji: "🎮", tag: "SPONSORED", title: "Build Your Harem Free", sub: "Recruit 200+ hentai waifus" },
  { emoji: "💋", tag: "AD", title: "Waifu Dating Simulator", sub: "Meet & date anime girls — free" },
  { emoji: "🔥", tag: "NUTAKU", title: "Top Hentai RPGs 2026", sub: "Play in browser, no download" },
];

// ── DOM helpers (imperative, outside React reconciliation) ─────────

let cardIdx = 0;
let sqIdx = 0;

function nextCardVariant(): CardVariant {
  const v = CARD_VARIANTS[cardIdx % CARD_VARIANTS.length];
  cardIdx++;
  return v;
}

function nextSquareVariant(): SquareVariant {
  const v = SQUARE_VARIANTS[sqIdx % SQUARE_VARIANTS.length];
  sqIdx++;
  return v;
}

function makePosterCardAd(): HTMLAnchorElement {
  const v = nextCardVariant();
  const a = document.createElement("a");
  a.className = "poster-card";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.dataset.ikuAd = "1";
  a.innerHTML = `
    <div class="poster-card__image">
      <div class="iku-ad__ribbon">AD</div>
      <div class="iku-ad__emoji">${v.emoji}</div>
      <div class="iku-ad__cta">▶ ${v.cta}</div>
    </div>
    <div class="poster-card__info">
      <span class="poster-card__tag">nutaku</span>
      <div class="poster-card__title">${v.title}</div>
      <div class="poster-card__meta"><span>★★★★★</span><span>${v.plays}</span></div>
    </div>
  `;
  return a;
}

function makeVideoCardAd(): HTMLAnchorElement {
  const v = nextCardVariant();
  const a = document.createElement("a");
  a.className = "video-card";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.dataset.ikuAd = "1";
  a.innerHTML = `
    <div class="video-card__media">
      <div class="iku-vad__ribbon">AD</div>
      <div class="iku-vad__emoji">${v.emoji}</div>
      <div class="iku-vad__cta">▶ ${v.cta}</div>
    </div>
    <div class="iku-vad__info">
      <div class="iku-vad__title">${v.title}</div>
      <div class="iku-vad__meta"><span>⭐ nutaku</span><span>${v.plays}</span></div>
    </div>
  `;
  return a;
}

function makeSquareBanner(): HTMLAnchorElement {
  const v = nextSquareVariant();
  const a = document.createElement("a");
  a.className = "iku-niche-square";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.innerHTML = `
    <div class="iku-niche-square__icon">${v.emoji}</div>
    <div class="iku-niche-square__body">
      <div class="iku-niche-square__tag">${v.tag}</div>
      <div class="iku-niche-square__title">${v.title}</div>
      <div class="iku-niche-square__sub">${v.sub}</div>
    </div>
    <div class="iku-niche-square__arrow">›</div>
  `;
  return a;
}

function showProModal() {
  if (document.getElementById("iku-niche-pro-modal")) return;
  if (sessionStorage.getItem("iku_pro_modal_shown") === "1") return;
  sessionStorage.setItem("iku_pro_modal_shown", "1");

  const m = document.createElement("div");
  m.id = "iku-niche-pro-modal";
  m.className = "iku-niche-pro-modal";
  m.innerHTML = `
    <div class="iku-niche-pro-box">
      <div class="iku-niche-pro-emoji">💎</div>
      <div class="iku-niche-pro-title">Tired of ads?</div>
      <div class="iku-niche-pro-sub">Go Pro — ad-free hentai streaming, 353K+ videos, no banners, no popups. Only €4.99/month.</div>
      <a class="iku-niche-pro-cta" href="/pricing">→ GET PRO €4.99/month</a>
      <button class="iku-niche-pro-dismiss" data-iku-close="pro-modal">No thanks, keep ads</button>
    </div>
  `;
  document.body.appendChild(m);
}

// ── Injection functions ────────────────────────────────────────────

function injectSticky(isFeed: boolean) {
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

function injectTopBanner(isFeed: boolean) {
  if (isFeed) return;
  if (window.innerWidth >= 768) return;
  if (document.body.dataset.pro === "1") return;
  if (document.getElementById("iku-niche-top")) return;

  const main =
    document.querySelector("main") ||
    document.querySelector(".hp-hero") ||
    document.querySelector(".carousel-section") ||
    document.querySelector("article");
  if (!main?.parentNode) return;

  const a = document.createElement("a");
  a.id = "iku-niche-top";
  a.className = "iku-niche-top";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.innerHTML = `
    <span class="iku-niche-top__badge">AD</span>
    <span>🎮 Play Free Hentai Games on Nutaku</span>
  `;
  main.parentNode.insertBefore(a, main);
}

function injectMidBanner(isFeed: boolean) {
  if (isFeed) return;
  if (window.innerWidth >= 768) return;
  if (document.body.dataset.pro === "1") return;
  if (document.getElementById("iku-niche-mid")) return;

  const sections = document.querySelectorAll(".carousel-section");
  let anchor: Element | null = null;
  if (sections.length >= 2) {
    anchor = sections[1];
  } else {
    anchor =
      document.querySelector(".watch-info") ||
      document.querySelector(".hp-hero") ||
      document.querySelector("article");
  }
  if (!anchor?.parentNode) return;

  const a = document.createElement("a");
  a.id = "iku-niche-mid";
  a.className = "iku-niche-mid";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.innerHTML = `
    <div class="iku-niche-mid__label">SPONSORED</div>
    <div class="iku-niche-mid__title">🔥 400+ Free Hentai Games</div>
    <div class="iku-niche-mid__sub">Uncensored visual novels, RPGs & dating sims — play free on Nutaku</div>
    <div class="iku-niche-mid__cta">▶ PLAY NOW</div>
  `;
  anchor.parentNode.insertBefore(a, anchor.nextSibling);
}

function injectSquareBanners(isFeed: boolean) {
  if (isFeed) return;
  if (window.innerWidth >= 768) return;
  if (document.body.dataset.pro === "1") return;

  const anchors: Element[] = [];
  document.querySelectorAll(".carousel-section").forEach((s) => anchors.push(s));
  document
    .querySelectorAll<HTMLElement>("main h2, main h3, article h2, article h3")
    .forEach((h) => {
      if (h.offsetHeight > 20) anchors.push(h);
    });

  anchors.forEach((anchor, i) => {
    if (i % 2 !== 0) return;
    const next = anchor.nextElementSibling;
    if (next?.classList?.contains("iku-niche-square")) return;
    if (anchor.getAttribute("data-iku-square") === "1") return;
    anchor.setAttribute("data-iku-square", "1");

    const a = makeSquareBanner();
    anchor.parentNode?.insertBefore(a, anchor.nextSibling);
  });
}

function injectNativeAds(isFeed: boolean) {
  if (isFeed) return;
  if (document.body.dataset.pro === "1") return;

  // Homepage carousels — 2 ads per track (pos 3 and 7)
  document.querySelectorAll<HTMLElement>(".carousel-track").forEach((track) => {
    const existing = track.querySelectorAll('[data-iku-ad="1"]').length;
    if (existing >= 2) return;
    if (existing === 0) {
      const cards = track.querySelectorAll<HTMLElement>(".poster-card:not([data-iku-ad])");
      if (cards.length >= 3) track.insertBefore(makePosterCardAd(), cards[2]);
    }
    const cards2 = track.querySelectorAll<HTMLElement>(".poster-card:not([data-iku-ad])");
    if (track.querySelectorAll('[data-iku-ad="1"]').length < 2 && cards2.length >= 7) {
      track.insertBefore(makePosterCardAd(), cards2[6]);
    }
  });

  // Homepage video grid — 2 ads per grid (pos 4 and 8)
  document.querySelectorAll<HTMLElement>(".hp-video-grid").forEach((grid) => {
    const existing = grid.querySelectorAll('[data-iku-ad="1"]').length;
    if (existing >= 2) return;
    if (existing === 0) {
      const cards = grid.querySelectorAll<HTMLElement>(
        ".poster-card:not([data-iku-ad]), .hp-hero-play-card"
      );
      if (cards.length >= 4) cards[3].parentNode?.insertBefore(makePosterCardAd(), cards[3]);
    }
    const cards2 = grid.querySelectorAll<HTMLElement>(
      ".poster-card:not([data-iku-ad]), .hp-hero-play-card"
    );
    if (grid.querySelectorAll('[data-iku-ad="1"]').length < 2 && cards2.length >= 8) {
      cards2[7].parentNode?.insertBefore(makePosterCardAd(), cards2[7]);
    }
  });

  // Watch page related grid (.video-grid with .video-card children)
  // Inject at positions 3, 7, 11 for max density on long pages
  document.querySelectorAll<HTMLElement>(".video-grid").forEach((grid) => {
    const existing = grid.querySelectorAll('[data-iku-ad="1"]').length;
    if (existing >= 3) return;
    const positions = [3, 7, 11];
    positions.forEach((pos, i) => {
      if (grid.querySelectorAll('[data-iku-ad="1"]').length > i) return;
      const cards = grid.querySelectorAll<HTMLElement>(".video-card:not([data-iku-ad])");
      if (cards.length >= pos) {
        cards[pos - 1].parentNode?.insertBefore(makeVideoCardAd(), cards[pos - 1]);
      }
    });
  });
}

function injectCornerAd(isFeed: boolean) {
  if (isFeed) return;
  if (window.innerWidth >= 768) return;
  if (document.body.dataset.pro === "1") return;
  if (document.getElementById("iku-niche-corner")) return;
  if (sessionStorage.getItem("iku_corner_dismissed") === "1") return;

  const a = document.createElement("a");
  a.id = "iku-niche-corner";
  a.className = "iku-niche-corner";
  a.href = NUTAKU_HREF;
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  a.innerHTML = `
    <div class="iku-niche-corner__icon">🎮</div>
    <div class="iku-niche-corner__text">PLAY<br>FREE</div>
    <div class="iku-niche-corner__close" data-iku-close="corner">×</div>
  `;
  document.body.appendChild(a);
}

// ── React component ────────────────────────────────────────────────

export function MobileNicheBanner() {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  // Tag body with pathname-derived class for CSS targeting
  useEffect(() => {
    document.body.classList.toggle("iku-feed", isFeed);
  }, [isFeed]);

  // Global click handler for close buttons — captures before React sees it
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = (e.target as HTMLElement)?.closest?.("[data-iku-close]");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const what = t.getAttribute("data-iku-close");
      if (what === "corner") {
        document.getElementById("iku-niche-corner")?.remove();
        sessionStorage.setItem("iku_corner_dismissed", "1");
        // Re-show after 60s so the user sees it again this session
        setTimeout(() => sessionStorage.removeItem("iku_corner_dismissed"), 60_000);
        showProModal();
      } else if (what === "pro-modal") {
        document.getElementById("iku-niche-pro-modal")?.remove();
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Main injection loop
  useEffect(() => {
    if (isFeed) {
      // On feed: strip any leftovers from previous routes
      document.getElementById("iku-niche-link")?.remove();
      document.getElementById("iku-niche-top")?.remove();
      document.getElementById("iku-niche-mid")?.remove();
      document.getElementById("iku-niche-corner")?.remove();
      document.querySelectorAll('[data-iku-ad="1"]').forEach((el) => el.remove());
      document.querySelectorAll(".iku-niche-square").forEach((el) => el.remove());
      return;
    }

    const tick = () => {
      injectSticky(isFeed);
      injectTopBanner(isFeed);
      injectMidBanner(isFeed);
      injectSquareBanners(isFeed);
      injectNativeAds(isFeed);
      injectCornerAd(isFeed);
    };

    const initial = setTimeout(tick, 150);
    // Re-run every 2s so late-loading grids + SPA navigations are caught
    const interval = setInterval(tick, 2000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [isFeed]);

  // SSR renders a <style> tag with all the ad CSS. The actual DOM nodes
  // are injected imperatively in the effects above so React's reconciler
  // never touches them (would otherwise strip them on hydration).
  return (
    <style
      id="iku-niche-style"
      dangerouslySetInnerHTML={{
        __html: `
          /* Kill ExoClick in-message / popup formats site-wide.
             These are 300x250 cam-girl takeovers that hijack the page. */
          [id^="exo-im-container"],
          [id^="exo-im-container-wrapper"],
          [class*="exo-im-popup"] {
            display: none !important;
            visibility: hidden !important;
          }

          @media (max-width: 767px) {
            /* Hide generic ExoClick mobile placements — they serve AI
               girlfriend / dating / cam creatives that don't match the
               hentai audience. Replaced below with Nutaku niche ads. */
            .sticky-footer-ad,
            .sticky-footer-ad__zone,
            .ad-zone--300x50,
            .ad-zone--above-player {
              display: none !important;
              visibility: hidden !important;
            }

            /* === STICKY BOTTOM BANNER === */
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
              animation: ikuFade 0.5s ease both;
            }
            .iku-feed .iku-niche-sticky { display: none !important; }

            /* === TOP BANNER === */
            .iku-niche-top {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              margin: 8px 8px 12px 8px;
              height: 56px;
              border-radius: 10px;
              background: linear-gradient(135deg, #3a86ff 0%, #8338ec 50%, #ff006e 100%);
              color: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              font-weight: 700;
              font-size: 13px;
              text-decoration: none;
              box-shadow: 0 4px 16px rgba(131, 56, 236, 0.4);
              position: relative;
              overflow: hidden;
            }
            .iku-niche-top::before {
              content: "";
              position: absolute;
              inset: 0;
              background:
                radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2), transparent 40%),
                radial-gradient(circle at 80% 50%, rgba(255,255,255,0.15), transparent 40%);
              pointer-events: none;
            }
            .iku-niche-top__badge {
              background: rgba(0,0,0,0.35);
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .iku-feed .iku-niche-top { display: none !important; }

            /* === MID INTERSTITIAL === */
            .iku-niche-mid {
              display: block;
              margin: 20px 8px;
              padding: 18px 16px;
              border-radius: 12px;
              background: linear-gradient(135deg, #ff006e 0%, #ff6b35 100%);
              color: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              text-decoration: none;
              box-shadow: 0 6px 24px rgba(255, 0, 110, 0.35);
              position: relative;
              overflow: hidden;
            }
            .iku-niche-mid::before {
              content: "";
              position: absolute;
              right: -20px;
              top: -20px;
              width: 140px;
              height: 140px;
              border-radius: 50%;
              background: rgba(255,255,255,0.15);
              pointer-events: none;
            }
            .iku-niche-mid__label {
              display: inline-block;
              background: rgba(0,0,0,0.35);
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.6px;
              margin-bottom: 6px;
            }
            .iku-niche-mid__title {
              font-size: 17px;
              font-weight: 800;
              line-height: 1.2;
              margin: 0 0 4px 0;
              position: relative;
              z-index: 2;
            }
            .iku-niche-mid__sub {
              font-size: 12px;
              opacity: 0.92;
              margin: 0 0 12px 0;
              position: relative;
              z-index: 2;
            }
            .iku-niche-mid__cta {
              display: inline-block;
              background: #fff;
              color: #ff006e;
              font-size: 12px;
              font-weight: 800;
              padding: 8px 16px;
              border-radius: 6px;
              position: relative;
              z-index: 2;
            }
            .iku-feed .iku-niche-mid { display: none !important; }

            /* === SQUARE BANNERS AFTER SECTIONS === */
            .iku-niche-square {
              display: flex;
              align-items: center;
              gap: 12px;
              margin: 16px 8px;
              padding: 14px;
              border-radius: 10px;
              background: linear-gradient(135deg, #8338ec 0%, #3a86ff 100%);
              color: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              text-decoration: none;
              box-shadow: 0 4px 16px rgba(58, 134, 255, 0.35);
              position: relative;
              overflow: hidden;
              min-height: 80px;
            }
            .iku-niche-square__icon {
              font-size: 42px;
              flex-shrink: 0;
              filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
            }
            .iku-niche-square__body { flex: 1; min-width: 0; }
            .iku-niche-square__tag {
              display: inline-block;
              background: rgba(0,0,0,0.35);
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .iku-niche-square__title {
              font-size: 14px;
              font-weight: 800;
              line-height: 1.2;
              margin: 0 0 2px 0;
            }
            .iku-niche-square__sub {
              font-size: 11px;
              opacity: 0.9;
              margin: 0;
            }
            .iku-niche-square__arrow {
              font-size: 22px;
              flex-shrink: 0;
            }
            .iku-feed .iku-niche-square { display: none !important; }

            /* === CORNER FLOATING AD === */
            .iku-niche-corner {
              position: fixed;
              right: 8px;
              bottom: 130px;
              z-index: 39;
              width: 96px;
              height: 96px;
              border-radius: 12px;
              background: linear-gradient(135deg, #ff006e 0%, #8338ec 100%);
              color: #fff;
              text-decoration: none;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 4px;
              box-shadow: 0 6px 20px rgba(255, 0, 110, 0.5);
              animation: ikuFade 0.5s ease both;
            }
            .iku-niche-corner__icon {
              font-size: 32px;
              filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
            }
            .iku-niche-corner__text {
              font-size: 9px;
              font-weight: 800;
              text-align: center;
              line-height: 1.1;
              padding: 0 4px;
            }
            .iku-niche-corner__close {
              position: absolute;
              top: -8px;
              right: -8px;
              width: 22px;
              height: 22px;
              background: #000;
              color: #fff;
              border-radius: 50%;
              border: 2px solid #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              cursor: pointer;
              z-index: 1;
              font-family: Arial;
              line-height: 1;
            }
            .iku-feed .iku-niche-corner { display: none !important; }

            @keyframes ikuFade {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: none; }
            }
          }

          @media (min-width: 768px) {
            .iku-niche-sticky,
            .iku-niche-top,
            .iku-niche-mid,
            .iku-niche-square,
            .iku-niche-corner {
              display: none !important;
            }
          }

          /* === NATIVE POSTER-CARD AD (inside .carousel-track / .hp-video-grid) === */
          .poster-card[data-iku-ad="1"] { cursor: pointer; }
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

          /* === NATIVE VIDEO-CARD AD (watch page .video-grid) === */
          .video-card[data-iku-ad="1"] {
            cursor: pointer;
            display: block;
            text-decoration: none;
            color: inherit;
          }
          .video-card[data-iku-ad="1"] .video-card__media {
            background: linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%) !important;
            position: relative;
            overflow: hidden;
            width: 100%;
            padding-bottom: 56.25%;
            border-radius: 8px;
          }
          .video-card[data-iku-ad="1"] .video-card__media::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3), transparent 50%),
              radial-gradient(circle at 70% 80%, rgba(255,255,255,0.18), transparent 45%);
            pointer-events: none;
          }
          .video-card[data-iku-ad="1"] .iku-vad__emoji {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -60%);
            font-size: 42px;
            z-index: 2;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
          }
          .video-card[data-iku-ad="1"] .iku-vad__ribbon {
            position: absolute;
            top: 6px;
            left: 6px;
            z-index: 3;
            background: rgba(0,0,0,0.78);
            color: #fff;
            font-size: 9px;
            font-weight: 800;
            padding: 3px 7px;
            border-radius: 4px;
            letter-spacing: 0.6px;
          }
          .video-card[data-iku-ad="1"] .iku-vad__cta {
            position: absolute;
            bottom: 8px;
            left: 8px;
            right: 8px;
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
          .video-card[data-iku-ad="1"] .iku-vad__info { padding: 8px 4px 4px 4px; }
          .video-card[data-iku-ad="1"] .iku-vad__title {
            font-size: 13px;
            font-weight: 700;
            line-height: 1.3;
            margin: 0 0 4px 0;
            color: inherit;
          }
          .video-card[data-iku-ad="1"] .iku-vad__meta {
            font-size: 11px;
            opacity: 0.7;
            display: flex;
            gap: 6px;
          }
          .iku-feed .video-card[data-iku-ad="1"] { display: none !important; }

          /* === PRO UPSELL MODAL (triggered on corner ad close) === */
          .iku-niche-pro-modal {
            position: fixed;
            inset: 0;
            z-index: 100;
            background: rgba(0,0,0,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: ikuFade 0.3s ease both;
          }
          .iku-niche-pro-box {
            background: linear-gradient(135deg, #1a0033 0%, #330066 100%);
            border: 2px solid #ff006e;
            border-radius: 16px;
            padding: 24px;
            max-width: 360px;
            text-align: center;
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 10px 40px rgba(255, 0, 110, 0.4);
            position: relative;
          }
          .iku-niche-pro-emoji { font-size: 48px; margin-bottom: 8px; }
          .iku-niche-pro-title { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; }
          .iku-niche-pro-sub {
            font-size: 13px;
            opacity: 0.85;
            margin: 0 0 16px 0;
            line-height: 1.4;
          }
          .iku-niche-pro-cta {
            display: block;
            background: linear-gradient(90deg, #ff006e, #8338ec);
            color: #fff;
            font-size: 14px;
            font-weight: 800;
            padding: 12px 20px;
            border-radius: 8px;
            text-decoration: none;
            margin-bottom: 8px;
          }
          .iku-niche-pro-dismiss {
            color: #fff;
            opacity: 0.6;
            font-size: 12px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
          }
        `,
      }}
    />
  );
}
