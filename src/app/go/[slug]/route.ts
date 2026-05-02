/**
 * /go/[slug] — Affiliate redirect handler.
 *
 * Reads slugs + targets from `lib/ad-registry.ts`. Fire-and-forget
 * PostHog event for click attribution; never blocks the redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { CR_OFFERS, crRedirect, type CrSlug } from "@/lib/ad-registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!(slug in CR_OFFERS)) {
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });
  }
  const url = crRedirect(slug as CrSlug);

  // Fire-and-forget PostHog click event for funnel attribution.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      "0.0.0.0";
    const ua = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    fetch("https://us.i.posthog.com/i/v0/e/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "affiliate_click",
        properties: {
          slug,
          $current_url: req.url,
          referer,
          $ip: ip,
          $user_agent: ua,
        },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  return NextResponse.redirect(url, 302);
}
