import { AdRotationBanner } from "@/components/AdJoiBanner";

// Re-purposed 2026-06-30. The old HilltopAds display banner painted a white
// canvas on 13 browse pages for ~$0.08/mo. Replaced in place (same component
// name = no need to touch 13 imports) with a self-controlled AFFILIATE 300x250
// creative (GIF + tracked /go link, approved CR offers). No white canvas, and
// affiliate pays far better than display at this volume. Brand rotates per
// request to cut ad blindness across multi-page sessions.
const BROWSE_SLUGS = ["candy-ai", "joi-ai", "swipey"] as const;

export function HilltopAdsBanner() {
  const slug = BROWSE_SLUGS[Math.floor(Math.random() * BROWSE_SLUGS.length)];
  return <AdRotationBanner slug={slug} surface="browse" />;
}
