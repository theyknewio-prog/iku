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

// FULL CrakRevenue AI catalog (38 offers) wired 2026-05-12 — user wanted
// "la totalité". Each slug uses CR's tracker URL with the offer ID. Where
// the same brand has Premium + Standard + Revshare variants, all three are
// exposed under suffixed slugs so we can rotate by EPC tier.
//
// EPC values frozen at catalog read 2026-05-12 — re-pull quarterly.
const AFFILIATE_LINKS: Record<string, string> = {
  // ── Premium tier (REQUEST APPROVAL — currently locked until $1 earned) ──
  "joi-ai": CR("10358"), // Joi PPS Premium $42, EPC $0.4806 — TOP EPC
  "candy-ai": CR("10335"), // Candy.ai PPS Premium $44, EPC $0.2606
  "girlfriend-gpt": CR("10407"), // GG PPS Premium $55, EPC $0.2516
  "ourdream-ai-premium": CR("10402"), // ourdream PPS Premium $42, EPC $0.0647

  // ── Approved PPS — usable today ──
  swipey: CR("10100"), // Swipey PPS $38.50, EPC $0.0583
  "darlink-ai": CR("10345"), // DarLink PPS $30, EPC $0.1831
  lovescape: CR("10223"), // Lovescape PPS $42, EPC $0.1643
  "get-harder": CR("10182"), // Get-Harder PPS $34, EPC $0.1506
  "ourdream-ai": CR("10138"), // ourdream PPS $32.40, EPC $0.0271
  "secrets-ai": CR("10381"), // Secrets.ai PPS $50, EPC $0.0452
  "joi-ai-t1": CR("10163"), // Joi Tier 1 PPS $35, EPC $0.0352 (fallback when Premium 10358 not approved yet)
  "joi-ai-t2": CR("10280"), // Joi Tier 2 PPS $28, EPC $0.0130
  "candy-ai-standard": CR("10022"), // Candy.ai PPS $36, EPC $0.0162
  fanfinity: CR("10141"), // Fanfinity PPS $17.50, EPC $0.0034

  // ── Approved Multi-CPA + Revshare (passive recurring) ──
  "xotic-ai": CR("10401"), // Xotic AI Revshare 35% (NEW)
  spicier: CR("10257"), // Spicier Multi-CPA (Exclusive)
  xtease: CR("10341"), // Xtease.ai Multi-CPA (Exclusive), EPC $0.0201
  "joi-ai-rs": CR("10222"), // Joi Revshare 28%, EPC $0.0537
  "candy-ai-rs": CR("9022"), // Candy.ai Revshare 40%
  "lovescape-rs": CR("10224"), // Lovescape Revshare 35%
  "darlink-ai-rs": CR("10344"), // DarLink Revshare 45%, EPC $0.0512
  "ourdream-ai-rs": CR("10139"), // ourdream Revshare 30%, EPC $0.0313
  "swipey-rs": CR("10219"), // Swipey Revshare 35%
  "secrets-ai-rs": CR("10406"), // Secrets.ai Revshare 40%
  "fanfinity-rs": CR("10140"), // Fanfinity Revshare 45%, EPC $0.0055
  "fantasy-ai": CR("10057"), // Fantasy.Ai Revshare 35%
  "mylovely-ai": CR("10318"), // MyLovely Ai Revshare 35%
  "dreambf-ai": CR("9183"), // DreamBF.ai Revshare 35%
  "dreamgf-ai": CR("9057"), // Dreamgf.ai Revshare 35%
  "ehentai-ai": CR("9182"), // eHentai.ai Revshare 35%

  // ── Direct affiliate programs (approved 2026-05-02 → 2026-05-05) ──
  "kupid-ai": "https://kpdtrk.com/iku-gg-gr53", // Kupid AI — Dub.co partner
  anifusion: "https://anifusion.ai/?atp=ikugg", // Anifusion — 30% lifetime
  soulkyn: "https://soulkyn.com/?_go=sab35", // Soulkyn — 15% recurring + 10% sub-aff
  // Cam network (Stripcash) — REV 20% lifetime, smart link routes per visitor geo
  stripcash:
    "https://go.mavrtracktor.com?userId=17e833691806534d444a0f2a237e4ac61d0cd81990649940427306c52266eced",
};

// Known crawler / bot user-agents. SEO crawlers (Yandex, Ahrefs, MJ12, …)
// sweep every /go/ link in the MegaFooter; matching UAs are bounced to the
// homepage with no event logged and no affiliate redirect.
const BOT_UA =
  /bot|crawl|spider|slurp|webindexer|wakeup-check|headless|phantom|python-requests|http-client|curl\/|wget|go-http|scrapy|facebookexternalhit|embedly|preview/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = AFFILIATE_LINKS[slug];
  if (!url)
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });

  const ua = req.headers.get("user-agent") || "";

  // Crawlers sweep every /go/ link in the footer — that pollutes PostHog
  // and pipes invalid traffic into CrakRevenue's tracker, which risks
  // flagging the affiliate account. Bots get no event and no affiliate
  // redirect; bounce them to the homepage instead.
  if (BOT_UA.test(ua)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // Fire-and-forget PostHog click event for funnel attribution.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      "0.0.0.0";
    const referer = req.headers.get("referer") || "";
    // PostHog requires `distinct_id` — without it events are silently
    // dropped (HTTP 200 but never stored). Bug found 2026-05-12 after 7
    // days of zero `affiliate_click` recorded despite live traffic.
    // Anonymous identifier = IP + UA hash (stable per visitor session).
    const distinctId = `anon-${ip}-${ua.slice(0, 32)}`.replace(/\s+/g, "_");
    fetch("https://us.i.posthog.com/i/v0/e/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "affiliate_click",
        distinct_id: distinctId,
        properties: {
          slug,
          distinct_id: distinctId,
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
