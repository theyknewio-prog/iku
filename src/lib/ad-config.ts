/**
 * ad-config.ts — intentionally gutted 2026-04-23.
 *
 * All ad network integrations (ExoClick, Adsterra, HilltopAds, HentaiPros)
 * were ripped out to reach a clean $0 baseline before rebuilding with the
 * Playmak3r stack (Clickadu + HilltopAds + Stripcash), one surface at a
 * time. The /api/vast route is kept for future VAST-based integrations
 * so we retain just enough shape here for it to compile.
 *
 * Add zone IDs / script URLs back piecewise as new ad surfaces ship.
 */

export const AD_ZONES = {
  exoclick: {
    /** Legacy placeholder — not mounted anywhere. */
    videoPreroll: "",
  },
} as const;

export const HILLTOPADS_SCRIPTS = {
  /** Legacy placeholder — not mounted anywhere. */
  vastPrerollUrl: "",
} as const;
