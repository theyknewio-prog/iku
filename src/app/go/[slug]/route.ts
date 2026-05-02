/**
 * /go/[slug] — Affiliate redirect handler.
 *
 * Minimal post-nuke (2026-05-02). Only Joi-AI for the homepage v1 surface.
 * Add more slugs as new placements ship — kept tiny on purpose.
 *
 * The redirect goes to CrakRevenue's tracker (t.vlmai-1.com) which then
 * routes to the offer landing page based on the offer ID in the path.
 * Logging is fire-and-forget to PostHog so a slow ingest never blocks
 * the user's redirect.
 */

import { NextRequest, NextResponse } from "next/server";

const CR_BASE = "?aff_sub5=SF_006OG000004lmDN";
const CR = (path: string) => `https://t.vlmai-1.com/410186/${path}${CR_BASE}`;

const AFFILIATE_LINKS: Record<string, string> = {
  "joi-ai": CR("8080"), // $42 PPS T1 Premium, EPC $0.46 — TOP CONVERTER
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = AFFILIATE_LINKS[slug];
  if (!url)
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });

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
