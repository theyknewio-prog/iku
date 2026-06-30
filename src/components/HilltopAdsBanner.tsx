"use client";

// DISABLED 2026-06-30: the HilltopAds banner script (zone 6969681) injects its
// OWN inner iframe whose creative/placeholder renders on a WHITE background —
// an ugly white 300x250 square on 13 browse pages (home/explore/trending/new/
// tags/tag/series/character/blog/glossary). It earned ~$0.02/7d (~$0.08/mo):
// not worth a white block on the most-viewed pages. The CSS-transparency fix
// can't reach the network's inner iframe, so we disable the surface entirely.
//
// These slots should be refilled with a self-controlled AFFILIATE banner
// (AdJoi/Soulkyn image — no white, higher revenue ceiling than display) rather
// than another display network. Re-enable display only if it ever pays enough
// to justify the UX hit.
export function HilltopAdsBanner() {
  return null;
}
