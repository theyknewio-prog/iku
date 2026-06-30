"use client";

// DISABLED 2026-06-30: ss.mrmnd.com/banner.js was loaded with NO zone/spot/
// publisher id, so it could never request a creative — the srcDoc iframe stayed
// an empty white UA canvas (the "pub blanche" on the homepage). Dead surface,
// $0 revenue (confirmed by the 2026-06-30 ad audit). Re-enable ONLY once wired
// with a real Mondiad zone UUID, the way the interstitial uses data-mndintid.
export function MondiadBanner(props: { width?: number; height?: number }) {
  void props;
  return null;
}
