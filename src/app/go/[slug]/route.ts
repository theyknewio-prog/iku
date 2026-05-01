/**
 * /go/[slug] — Affiliate redirect handler.
 *
 * Replace placeholder ?via= URLs with real tracking URLs as each affiliate
 * signup completes. The dictionary lives here server-side so tracking URLs
 * can be updated via a code push without touching any component.
 *
 * Logging: fire-and-forget POST to PostHog ingest (posthog-node is not
 * installed; we use a raw fetch so there is no extra dependency).
 */

import { NextRequest, NextResponse } from "next/server";

const AFFILIATE_LINKS: Record<string, string> = {
  "candy-ai": "https://candy.ai/?via=ikugg", // CrakRevenue link TBD
  "only-waifus": "https://onlywaifus.ai/?via=ikugg", // FirstPromoter link TBD
  "anime-genius": "https://animegenius.live3d.io/?via=ikugg", // TBD
  "kupid-ai": "https://kupid.ai/?via=ikugg", // Dub TBD
  "dream-gf": "https://dreamgf.ai/?via=ikugg", // Traceo TBD
  "crush-on": "https://crushon.ai/?via=ikugg", // Tapfiliate TBD
  soulkyn: "https://soulkyn.com/?via=ikugg", // direct TBD
  "nomi-ai": "https://nomi.ai/?via=ikugg", // direct TBD
};

/** Fire-and-forget PostHog event. Never throws — a failed capture must not
 *  block the redirect response. */
function captureAffiliateClick(
  slug: string,
  referrer: string,
  pathname: string,
): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  const body = JSON.stringify({
    api_key: key,
    event: "affiliate_click",
    distinct_id: "server", // anonymous server-side event; no user PII
    properties: {
      slug,
      referrer,
      pathname,
      $lib: "iku-server",
    },
    timestamp: new Date().toISOString(),
  });

  fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    // Do not await — let it run in the background. Next.js keeps the process
    // alive long enough for this small request to complete.
  }).catch(() => {
    // Swallow silently — PostHog being down must never break affiliate links.
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = AFFILIATE_LINKS[slug];

  if (!destination) {
    return new NextResponse("Not found", { status: 404 });
  }

  const referrer = request.headers.get("referer") ?? "";
  const pathname = `/go/${slug}`;

  captureAffiliateClick(slug, referrer, pathname);

  // 302 (temporary) rather than 301 so browsers don't cache the redirect
  // — tracking URLs will change as affiliate signups complete.
  return NextResponse.redirect(destination, { status: 302 });
}
