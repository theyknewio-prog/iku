"use client";

// DISABLED 2026-06-30: ss.mrmnd.com/native.js was loaded with NO zone/spot/
// publisher id, so it could never request a creative — same empty white UA
// canvas problem as MondiadBanner. Dead surface, $0 revenue (confirmed by the
// 2026-06-30 ad audit). Re-enable ONLY once wired with a real Mondiad native
// zone UUID + container per Mondiad spec.
export function MondiadNative(props: { width?: number; height?: number }) {
  void props;
  return null;
}
