/**
 * ad-config.ts — Ad zone IDs for ExoClick and Adsterra
 *
 * ExoClick is the primary ad network. Adsterra is secondary (Social Bar only,
 * not yet active). Zone IDs correspond to placements created in the ExoClick
 * dashboard for iku.gg.
 */

export const AD_ZONES = {
  exoclick: {
    /** Banner 728x90 — under the video player on desktop */
    watchUnderplayer728: '5893256',
    /** Banner 300x50 — mobile "Sticky Mobile Banner" (ExoClick ad_type 10).
     *  ExoClick doesn't sell 320x50; 300x50 is the closest equivalent and
     *  fits perfectly inside a 320px mobile viewport with 10px of margin.
     *  Created via ExoClick API on 2026-04-10. */
    mobileBanner300x50: '5895978' as string | null,
    /** Banner 300x250 — sidebar + in-content placements */
    sidebar300: '5893266',
    /** Banner 300x600 — NOT YET CREATED in ExoClick dashboard.
     *  Previously this was set to the same ID as sidebar300 which caused
     *  a 300x250 creative to render in a 300x600 container (visible black
     *  300x350 gap). Until a real 300x600 zone exists, set to null and
     *  the watch page falls back to not rendering this slot. */
    sidebar300x600: null as string | null,
    /** Video Pre-roll — watch page (not used yet) */
    videoPreroll: '5893268',
    /** Popunder — 1 per session, no visual element */
    popunder: '5893290',
    /** Native 300x250 — inside video grids */
    nativeGrid: '5893292',
    /** Interstitial — feed/shorts between swipes */
    feedInterstitial: '5893294',
  },
  adsterra: {
    socialBar: '28986140',
    mobile320: '28986143',
    banner728: '28986144',
    banner300: '28986141',
    native: '28986139',
    popunder: '28986138',
  },
} as const;

/**
 * Real Adsterra script URLs per zone (grabbed from publisher dashboard Get Code
 * on 2026-04-11 via Playwright MCP). The numeric IDs above are Adsterra's internal
 * refs — the publisher script URL uses a hashed token per zone that only lives
 * in the Get Code modal. Without these, the Adsterra script tag loads a 404.
 *
 * Social Bar + Popunder = single one-liner scripts, inject direct.
 * Banner + Native = need atOptions wrapper (see AdsterraBanner.tsx). Because
 * all Adsterra banners share a global `window.atOptions`, running more than
 * one banner on the same page requires each to live inside its own `<iframe
 * srcDoc=...>` — otherwise the last one wins (confirmed by publisher docs +
 * adsterra.com/blog/displaying-different-banners-on-mobile-and-desktop).
 */
export const ADSTERRA_SCRIPTS = {
  popunder: 'https://pl29086637.profitablecpmratenetwork.com/3a/c5/c5/3ac5c557ed669544ce272e344486c7d0.js',
  native:   'https://pl29086638.profitablecpmratenetwork.com/9887f6df21db62687c837f0362b4b16c/invoke.js',
  socialBar:'https://pl29086639.profitablecpmratenetwork.com/c8/e2/6d/c8e26d62c412ef890a2ce3e83d94da53.js',
  banner300x250: 'https://www.highperformanceformat.com/b149e9de3cee857db29388ee9ca47054/invoke.js',
  banner160x600: 'https://www.highperformanceformat.com/ef2e2fad3e1fdae3f74774dac32c0ca5/invoke.js',
  banner320x50:  'https://www.highperformanceformat.com/f11ddd24aa56b6d650655b4563d67461/invoke.js',
  banner728x90:  'https://www.highperformanceformat.com/5a7f6bdcb73dec1719a9657cd49a2bd0/invoke.js',
} as const;

/** The global ExoClick ad provider script URL */
export const EXOCLICK_SCRIPT_URL = 'https://a.magsrv.com/ad-provider.js';
