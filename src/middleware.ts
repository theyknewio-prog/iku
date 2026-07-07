/**
 * middleware.ts — Static CSP header (no per-request nonce).
 *
 * Post ad-nuke 2026-05-02: stripped all ad-network whitelist entries
 * (CrakRevenue, HilltopAds, ExoClick, Adsterra, PopAds, Stripcash, etc).
 * CSP now only whitelists video sources, analytics, fonts, push, and the
 * CF Worker used to proxy Danbooru thumbnails.
 *
 * `'unsafe-inline'` + `'unsafe-eval'` kept because parts of the codebase
 * still use them (inline schema JSON-LD, dynamic imports). Hardening can
 * happen later once nonce-based wiring is restored.
 */

import { NextRequest, NextResponse } from "next/server";

// Sections that expose a markdown mirror under /md/<section>/<slug>.
// Append `.md` to any canonical URL → middleware rewrites to /md/.
const MD_SECTIONS = new Set([
  "watch",
  "blog",
  "glossary",
  "tag",
  "character",
  "series",
]);

export function middleware(request: NextRequest) {
  // Markdown-mirror rewrite: /watch/foo.md → /md/watch/foo (same for
  // blog/glossary/tag/character/series). Anthropic-style convention used
  // by LLM crawlers (ChatGPT, Claude, Perplexity, Google AI Overviews).
  const path = request.nextUrl.pathname;
  if (path.endsWith(".md")) {
    const m = path.match(/^\/([^/]+)\/(.+)\.md$/);
    if (m && MD_SECTIONS.has(m[1])) {
      const url = request.nextUrl.clone();
      url.pathname = `/md/${m[1]}/${m[2]}`;
      return NextResponse.rewrite(url);
    }
  }

  const response = NextResponse.next();

  // Advertise the markdown mirror to LLM crawlers via Link header.
  const mdMatch = path.match(/^\/([^/]+)\/([^/]+?)\/?$/);
  if (mdMatch && MD_SECTIONS.has(mdMatch[1])) {
    response.headers.set(
      "Link",
      `<https://iku.gg/${mdMatch[1]}/${mdMatch[2]}.md>; rel="alternate"; type="text/markdown"`,
    );
  }

  // ─── CSP strategy (2026-07-07) ─────────────────────────────────────
  // script-src is the ONLY whitelist that meaningfully limits XSS impact,
  // so it stays strict. img/media/connect/frame moved to scheme-wide
  // `https:` because the exhaustive host lists (60+ video CDNs × 3
  // directives + 5 ad networks × 5 directives) pushed the CSP header to
  // 15.5KB — over the 16KB total-header limit of Node/most HTTP clients
  // ("Header overflow"). The lists also broke silently every time an ad
  // network rotated shards or a scraper added a CDN (5+ incidents:
  // adsco.re:2087, klmmnd, portalfluently, btmnd, img4.gelbooru…).
  // A scheme source matches any host and any port, so those failure
  // classes are gone for non-script resources.

  // Analytics + push notifications (the only third-party scripts left).
  // Yandex Metrica (counter 109826109) added 2026-06-13 — feeds the
  // behavioral signals (dwell/CTR/Webvisor) that dominate Yandex ranking,
  // and speeds Yandex crawl. tag.js loads from mc.yandex.ru; beacons +
  // Webvisor session-replay uploads go to mc.yandex.ru / mc.yandex.com.
  const ANALYTICS =
    "https://us-assets.i.posthog.com https://us.i.posthog.com https://cdn.onesignal.com https://*.onesignal.com https://onesignal.com https://mc.yandex.ru https://mc.yandex.com https://mc.yandex.com.tr https://*.mc.yandex.ru https://yastatic.net";

  // Ad-tech hosts — re-added 2026-05-02 for Placement A (CR Joi GIF) +
  // Placement B (HilltopAds banner zone 6969681). Minimum set to make
  // the 2 surfaces fire correctly without breaking attribution:
  //   - imglnkx: CR creative GIFs (img-src)
  //   - vlmai-1, mbjms, scptp9, crxcr2, crxcra: CR redirect/popup hosts
  //   - adsco.re: CR fraud verification (CRITICAL — without this, CR
  //     scrubs every click as 'unverified' = 0 conversions)
  //   - blockadsnot, cloudfront: HilltopAds anti-adblock (loaded by
  //     their banner script; without it they downgrade fill rate)
  //   - selfassured-celebration + 12 other rotating shards: HilltopAds
  //     CDN. Bare + wildcard because CSP wildcards don't match apex.
  const HILLTOPADS_SHARDS = [
    "selfassured-celebration.com",
    "sorrowfulpsychology.com",
    "difficultblock.com",
    "nightdestruct.com",
    "lumbering-form.com",
    "protrafficinspector.com",
    "pretrafficinspector.com",
    "skinnycrawlinglax.com",
    "sourshaped.com",
    "realizationnewestfangs.com",
    "hotfree123.com",
    "preferencenail.com",
    "wayfarerorthodox.com",
    "kettledroopingcontinuation.com",
  ];
  const HILLTOPADS_HOSTS = HILLTOPADS_SHARDS.flatMap((h) => [
    `https://${h}`,
    `https://*.${h}`,
  ]).join(" ");
  // Adscore (CR fraud check) connects to its shards on the NON-STANDARD port
  // 2087 (e.g. https://4.adsco.re:2087/). A host-source without a port only
  // matches 443, so https://*.adsco.re was silently blocking the verification
  // beacon -> CR scrubbed every click as 'unverified' = 0 conversions. Add the
  // :2087 variants. Also add the bare blockadsnot.com (wildcard misses apex).
  // Found via live console audit 2026-06-30.
  const CR_HOSTS =
    "https://*.imglnkx.com https://imglnkx.com https://*.vlmai-1.com https://*.mbjms.com https://*.scptp9.com https://*.crxcr2.com https://*.crxcra.com https://*.adsco.re https://adsco.re https://*.adsco.re:2087 https://adsco.re:2087 https://*.blockadsnot.com https://blockadsnot.com https://*.cloudfront.net https://snappypractice.com https://*.snappypractice.com";
  // Mondiad — site 27564 ACCEPTED 2026-05-11, 4 zones live, 11-day 100% revshare
  // promo. Static delivery host is ss.mrmnd.com; creatives/iframes/click-trackers
  // rotate through several mondiad subdomains so the wildcard catches them.
  // Live audit 2026-06-30: the Mondiad interstitial/push scripts (loaded from
  // ss.mrmnd.com) make runtime connect/img-sync calls to sibling domains
  // klmmnd.com and cs.eu.cckmnd.com that the mrmnd-only list never covered —
  // so the SDK never initialised (window.mondiad stayed undefined). Whitelist
  // the sync domains so the live zones can actually fill.
  const MONDIAD_HOSTS =
    "https://*.mrmnd.com https://mrmnd.com https://klmmnd.com https://*.klmmnd.com https://cckmnd.com https://*.cckmnd.com https://atmndx.com https://*.atmndx.com https://btmnd.com https://*.btmnd.com";
  // ExoClick (re-lit 2026-07-03) — ad-provider.js from a.magsrv.com, creatives
  // and click-trackers rotate across magsrv/exosrv/exoclick, media on afcdn.
  // Both bare + wildcard variants (wildcards never cover the apex).
  // Live console 2026-07-03: creatives come from bkcdn.net (img/video),
  // clickthrough frames from marzaent.com; exdynsrv/wpncdn are the other
  // documented ExoClick serving domains — whitelist them all up front.
  const EXOCLICK_HOSTS =
    "https://magsrv.com https://*.magsrv.com https://exosrv.com https://*.exosrv.com https://exoclick.com https://*.exoclick.com https://afcdn.net https://*.afcdn.net https://bkcdn.net https://*.bkcdn.net https://marzaent.com https://*.marzaent.com https://exdynsrv.com https://*.exdynsrv.com https://wpncdn.com https://*.wpncdn.com";
  // Adsterra (units reactivated 2026-07-07: Popunder_1 28986138 + SocialBar_1
  // 28986140). Direct-link domain is effectivecpmnetwork.com; their script
  // tags serve from highperformanceformat / effectiveratecpm /
  // profitableratecpm shards. Both bare + wildcard (wildcards miss the apex).
  // Re-check live console after wiring each unit — Adsterra rotates shards.
  // portalfluently.com: 2nd-stage script chained by the Social Bar tag
  // (pl*.effectivecpmnetwork.com → sfp.js). Found via live console probe
  // 2026-07-07 — same rotating-shard pattern as ExoClick bkcdn/marzaent.
  // Re-probe the console after each Adsterra change; shards rotate.
  const ADSTERRA_HOSTS =
    "https://effectivecpmnetwork.com https://*.effectivecpmnetwork.com https://highperformanceformat.com https://*.highperformanceformat.com https://effectiveratecpm.com https://*.effectiveratecpm.com https://profitableratecpm.com https://*.profitableratecpm.com https://portalfluently.com https://*.portalfluently.com https://show-sb.com https://*.show-sb.com";
  const AD_SCRIPT = `${HILLTOPADS_HOSTS} ${CR_HOSTS} ${MONDIAD_HOSTS} ${EXOCLICK_HOSTS} ${ADSTERRA_HOSTS}`;

  // `'unsafe-inline'` + `'unsafe-eval'` kept for inline JSON-LD scripts
  // and React dev tooling. Tighten later with hash-based CSP.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ANALYTICS} ${AD_SCRIPT} https://static.cloudflareinsights.com https://*.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // worker-src: app + ad scripts spawn blob: web workers; default-src 'self'
    // doesn't cover blob workers, so they were throwing CSP errors. (2026-06-13)
    "worker-src 'self' blob:",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Referrer-Policy: keep origin on cross-site navigations. Pages that
  // need full referer (none today) can override per-route.
  response.headers.set("Referrer-Policy", "no-referrer-when-downgrade");

  return response;
}

// Only run on document requests — skip static assets, API routes that don't
// render HTML, and Next.js internals.
export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap|og-|icon|manifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
