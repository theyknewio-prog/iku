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
// CR tracking link format = {domain}/{affiliate_id}/{offer_id}/{url_id}.
// The trailing /0 (default landing page) is REQUIRED — without it the
// tracker serves a blank 200 page: no redirect, no click recorded.
// Root cause of 100% CR click loss, found 2026-07-03 (CR dashboard showed
// 0 clicks all-time while PostHog logged 800+/mo). Links re-generated via
// phoenix-api.crakrevenue.com/offer/generate-tracking-link and each one
// verified live (302 chain → offer landing) before shipping.
// The tracker domain varies per vertical: t.vlmai-1.com (AI),
// t.aagm.link (Adult Gaming), t.bbwafx.com (XGamehub).
const CR = (path: string) => `https://t.vlmai-1.com/410186/${path}/0${CR_BASE}`;
const CRGAME = (path: string) =>
  `https://t.aagm.link/410186/${path}/0${CR_BASE}`;
// Dating + Cam verticals (added 2026-07-07). Domains pulled from
// phoenix-api generate-tracking-link and every link curl -L verified to a
// real landing page before shipping: t.crdtg3.com (Dating), t.acust-7.com
// (Smartlinks), t.mbjrkmms.com (Jerkmate/Cam).
const CRDATE = (path: string) =>
  `https://t.crdtg3.com/410186/${path}/0${CR_BASE}`;
const CRSMART = (path: string) =>
  `https://t.acust-7.com/410186/${path}/0${CR_BASE}`;
const CRCAM = (path: string) =>
  `https://t.mbjrkmms.com/410186/${path}/0${CR_BASE}`;

// Geo-routed hub slugs (2026-07-07). Our affiliate CLICKS are 80% Tier-1
// (US 187 / NL 97 / GB 46 / DE 31 per PostHog 14d) but every slug used to
// send all geos to the same offer — US clicks on RU-friendly offers and
// vice-versa convert at ~0. Cloudflare sets `cf-ipcountry` on every
// request; route each click to the best APPROVED CR offer for its geo,
// falling back to CR's own geo-adaptive Smartlink for the long tail.
// EPCs from catalog pull 2026-07-06 (re-pull quarterly, IDs rotate).
const GEO_HUBS: Record<string, Record<string, string>> = {
  // Dating hub — footer/nav "Local Dating" style links.
  meet: {
    US: CRDATE("7912"), // Instabang PPS $40 — EPC $0.938, best in catalog
    CA: CRDATE("7912"),
    GB: CRDATE("10285"), // Adult FriendFinder LQ PPS $40 — EPC $0.593
    AU: CRDATE("8570"), // GoNaughty DOI $4.20 — pays on free signup
    DE: CRDATE("10444"), // lovefrauen PPS $70 — EPC $0.381
    NL: CRDATE("9433"), // EroFantasie DOI $3.78 (BE/NL)
    BE: CRDATE("9433"),
    DEFAULT: CRSMART("3785"), // DatingSmartlink — geo-adaptive, our only
    // paid conversion so far (2026-07-03) came through it
  },
  // Live cams hub — Jerkmate PPS only pays its 5 target geos.
  cams: {
    US: CRCAM("8780"), // Jerkmate PPS $50 — EPC $0.270, CR exclusive
    CA: CRCAM("8780"),
    GB: CRCAM("8780"),
    AU: CRCAM("8780"),
    NZ: CRCAM("8780"),
    DEFAULT: CRSMART("3664"), // Cam Smartlink — geo-adaptive
  },
};

// FULL CrakRevenue AI catalog (38 offers) wired 2026-05-12 — user wanted
// "la totalité". Each slug uses CR's tracker URL with the offer ID. Where
// the same brand has Premium + Standard + Revshare variants, all three are
// exposed under suffixed slugs so we can rotate by EPC tier.
//
// EPC values frozen at catalog read 2026-05-12 — re-pull quarterly.
const AFFILIATE_LINKS: Record<string, string> = {
  // ── Premium tier REROUTED 2026-06-30 → approved variants ──
  // The Premium offer IDs (10358/10335/10407/10402) are "REQUEST APPROVAL"
  // and locked until $1 earned. Sending our #1 traffic slug (joi-ai, 189
  // clicks/mo) to a locked offer = CR bounces it to a fallback that credits
  // nothing → permanent $0 (the cycle: can't earn the $1 that unlocks them).
  // Route the high-traffic public slugs to their APPROVED equivalents so they
  // actually credit. Flip back to the Premium IDs once approved.
  "joi-ai": CR("10415"), // → Joi PPS $35 (approved). 10163 removed from CR catalog; was 10358 Premium (locked)
  "candy-ai": CR("10022"), // → Candy.ai PPS $36 (approved). was 10335 Premium (locked)
  "girlfriend-gpt": CR("10046"), // GG PPS $45 APPROVED (EPC $0.0367). Was 10407 Premium $55 = REQUEST APPROVAL locked → credited $0 since day one. Flip back once unlocked.
  "ourdream-ai-premium": CR("10138"), // → ourdream PPS $32.40 (approved). was 10402 Premium (locked)

  // ── Approved PPS — usable today ──
  swipey: CR("10100"), // Swipey PPS $38.50, EPC $0.0583
  "darlink-ai": CR("10345"), // DarLink PPS $30, EPC $0.1831
  lovescape: CR("10223"), // Lovescape PPS $42, EPC $0.1643
  "get-harder": CR("10182"), // Get-Harder PPS $34, EPC $0.1506
  "ourdream-ai": CR("10138"), // ourdream PPS $32.40, EPC $0.0271
  "secrets-ai": CR("10381"), // Secrets.ai PPS $50, EPC $0.0452
  "joi-ai-t1": CR("10415"), // Joi PPS $35 (10163 removed from CR catalog)
  "joi-ai-t2": CR("10415"), // Joi PPS $35 (10280 dead — generate-tracking-link 403s)
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

  // ── Adult Gaming (added 2026-07-03 — offer aligned with hentai traffic) ──
  "hentai-heroes": CRGAME("10049"), // Hentai Heroes PPS $45.98
  "hentai-heroes-rs": CRGAME("6562"), // Hentai Heroes Revshare Lifetime 50%
  xgamehub: `https://t.bbwafx.com/410186/10421/0${CR_BASE}`, // XGamehub PPS $35, EPC $0.106

  // ── Direct affiliate programs (approved 2026-05-02 → 2026-05-05) ──
  "kupid-ai": "https://kpdtrk.com/iku-gg-gr53", // Kupid AI — Dub.co partner
  anifusion: "https://anifusion.ai/?atp=ikugg", // Anifusion — 30% lifetime
  soulkyn: "https://soulkyn.com/?_go=sab35", // Soulkyn — 15% recurring + 10% sub-aff
  // Cam network (Stripcash) — REV 20% lifetime, smart link routes per visitor geo
  stripcash:
    "https://go.mavrtracktor.com?userId=17e833691806534d444a0f2a237e4ac61d0cd81990649940427306c52266eced",

  // ── Dating + Cam PPS/DOI (added 2026-07-07, all APPROVED) ──
  // Our click audience is 80% Tier-1 (US/NL/GB/DE) — these EPCs are 3-30×
  // the AI-companion offers the site pushed until now. DOI offers pay on a
  // free double-opt-in signup (no purchase needed) = fastest path to first $.
  "adult-friendfinder": CRDATE("4299"), // AFF PPS $90, EPC $0.507
  instabang: CRDATE("7912"), // PPS $40, EPC $0.938 (AU/CA/US)
  "aff-lq": CRDATE("10285"), // AFF low-quality-traffic variant, PPS $40, EPC $0.593
  wannahookup: CRDATE("8517"), // DOI $4.55 US — free signup payout
  milffindr: CRDATE("9736"), // DOI $3.36 UK
  gonaughty: CRDATE("8570"), // DOI $4.20 AU
  naughtycharm: CRDATE("10366"), // PPS $56 US, EPC $0.179
  hometownflirt: CRDATE("10435"), // PPS $81 US, EPC $0.321
  lovefrauen: CRDATE("10444"), // PPS $70 DE, EPC $0.381
  erofantasie: CRDATE("9433"), // DOI $3.78 BE/NL
  "dating-smart": CRSMART("3785"), // DatingSmartlink, geo-adaptive Multi-CPA
  "cam-smart": CRSMART("3664"), // Cam Smartlink, geo-adaptive Multi-CPA
  jerkmate: CRCAM("8780"), // Jerkmate PPS $50 (US/CA/GB/AU/NZ), EPC $0.270
  "jerkmate-rs": CRCAM("6224"), // Jerkmate Revshare Lifetime 30%
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
  // Geo hubs first: Cloudflare stamps cf-ipcountry on every request (we sit
  // behind CF, header is trustworthy). Missing header (direct origin hit,
  // health checks) falls through to the hub's DEFAULT smartlink.
  const geoCountry = (req.headers.get("cf-ipcountry") || "").toUpperCase();
  const hub = GEO_HUBS[slug];
  const url = hub ? (hub[geoCountry] ?? hub.DEFAULT) : AFFILIATE_LINKS[slug];
  if (!url)
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });

  const ua = req.headers.get("user-agent") || "";

  // Crawlers sweep every /go/ link in the footer — that pollutes PostHog
  // and pipes invalid traffic into CrakRevenue's tracker, which risks
  // flagging the affiliate account. Bots get no event and no affiliate
  // redirect; bounce them to the homepage instead.
  if (BOT_UA.test(ua)) {
    return NextResponse.redirect("https://iku.gg/", 302);
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
          geo_country: geoCountry || "unknown",
          resolved_url: url,
        },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  return NextResponse.redirect(url, 302);
}
