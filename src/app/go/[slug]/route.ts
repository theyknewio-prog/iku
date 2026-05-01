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

/**
 * CrakRevenue direct AI offers — pulled from CR's AI vertical (catalog id 233)
 * 2026-05-02. Direct-offer tracking links convert WAY better than the
 * Smartlink: AI Smartlink EPC $0.0007 vs direct offers up to $0.46 (660×).
 *
 * EPC values (from CR dashboard, May 2026):
 *   joi-ai           $0.4608   $42 PPS Tier 1 Premium
 *   candy-ai         $0.2225   $44 PPS Tier 1 Premium
 *   darlink-ai       $0.1960   $30 PPS
 *   lovescape        $0.1681   $35 PPS
 *   get-harder       $0.1636   $34 PPS
 *   secrets-ai       $0.1191   $50 PPS
 *   girlfriend-gpt   premium   $55 PPS
 *   dream-gf         $0.0110   35% revshare lifetime
 *
 * Tracking domain is `t.vlmai-1.com` (different from old Smartlink mbjms host —
 * needs CSP whitelist via middleware.ts redirect-allowance + img/connect-src).
 */
const CR_BASE = "?aff_sub5=SF_006OG000004lmDN";
const CR = (path: string) => `https://t.vlmai-1.com/410186/${path}${CR_BASE}`;

const AFFILIATE_LINKS: Record<string, string> = {
  // === CrakRevenue direct AI offers (May 2026 EPC verified) ===
  "candy-ai": CR("8025"), // $44 PPS T1 Premium, EPC $0.22
  "joi-ai": CR("8080"), // $42 PPS T1 Premium, EPC $0.46 — TOP EPC
  "girlfriend-gpt": CR("8184"), // $55 PPS Premium
  "secrets-ai": CR("10381/0"), // $50 PPS, EPC $0.12
  "get-harder": CR("10182/0"), // $34 PPS, EPC $0.16
  "darlink-ai": CR("10345/0"), // $30 PPS, EPC $0.20
  lovescape: CR("7886"), // $35 PPS, EPC $0.17
  "dream-gf": CR("6523"), // 35% revshare lifetime

  // === Smartlink fallback for slugs not in CR catalog ===
  "only-waifus": "https://onlywaifus.ai/?via=ikugg", // FirstPromoter pending
  "anime-genius": "https://animegenius.live3d.io/?via=ikugg", // direct pending
  "kupid-ai": "https://kupid.ai/?via=ikugg", // Dub pending
  "crush-on": "https://crushon.ai/?via=ikugg", // Tapfiliate pending
  soulkyn: "https://soulkyn.com/?via=ikugg", // direct pending
  "nomi-ai": "https://nomi.ai/?via=ikugg", // direct pending
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
