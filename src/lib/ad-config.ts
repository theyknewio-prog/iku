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
    /** Banner 320x50 — mobile version of the watch underplayer.
     *  TODO: create this zone in the ExoClick dashboard (Zone Type: Banner,
     *  Size: 320x50). Paste the id here. Until then, mobile uses the
     *  Adsterra 320x50 fallback via a different rendering path, or clips
     *  the 728x90 with overflow:hidden (current behavior). */
    mobileBanner320: null as string | null,
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

/** The global ExoClick ad provider script URL */
export const EXOCLICK_SCRIPT_URL = 'https://a.magsrv.com/ad-provider.js';
