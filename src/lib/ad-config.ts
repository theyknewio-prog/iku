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
    /** Banner 300x250 — sidebar + in-content placements */
    sidebar300: '5893266',
    /** Banner 300x600 — tall sidebar tower, watch page desktop sidebar */
    sidebar300x600: '5893266',
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
