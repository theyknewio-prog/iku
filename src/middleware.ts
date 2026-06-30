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

  // ─── Video source CDNs ─────────────────────────────────────────────
  // All sources our scrapers + player consume. Each gets the bare domain
  // and the wildcard form because CSP wildcards do not match the apex.
  const VIDEO_HOSTS = [
    "cdn.donmai.us",
    "danbooru.donmai.us",
    "gelbooru.com",
    "*.gelbooru.com",
    "rule34.xxx",
    "*.rule34.xxx",
    "rule34video.com",
    "*.rule34video.com",
    "hgasm1.com",
    "hgasm2.com",
    "hgasm3.com",
    "hgasm4.com",
    "hgasm5.com",
    "hgasm6.com",
    "hgasm7.com",
    "hgasm8.com",
    "hgasm9.com",
    "hentaicity.com",
    "*.hentaicity.com",
    "eporner.com",
    "*.eporner.com",
    "sfmcompile.club",
    "*.sfmcompile.club",
    "3dhentai.tube",
    "*.3dhentai.tube",
    "hentaiplay.net",
    "*.hentaiplay.net",
    "hentaiplanet.info",
    "*.hentaiplanet.info",
    "hentaisea.com",
    "*.hentaisea.com",
    "hentaibros.net",
    "*.hentaibros.net",
    "hentaifreak.org",
    "*.hentaifreak.org",
    "media.hentaifreak.org",
    "tube.hentaistream.com",
    "*.hentaistream.com",
    "i0.wp.com",
    "i1.wp.com",
    "i2.wp.com",
    "hentaicloud.com",
    "*.hentaicloud.com",
    "www.hentaicloud.com",
    "vdownload.hembed.com",
    "*.hembed.com",
    "hentaimama.io",
    "hentai.tv",
    "animeidhentai.com",
    "watchhentai.net",
    "hentaiworld.tv",
    "hentaigasm.com",
    "gdvid.info",
    "*.gdvid.info",
    "javprovider.com",
    "*.javprovider.com",
    "na-01.javprovider.com",
    "pornobuono.com",
    "*.pornobuono.com",
    "vintageporno.stream",
    "*.vintageporno.stream",
    "cdn.vintageporno.stream",
    "streamhentai.org",
    "*.streamhentai.org",
    "cdn1.streamhentai.org",
    "cdn3.streamhentai.org",
    "*.ahcdn.com",
    "ahcdn.com",
  ];
  const VIDEO_HOSTS_HTTPS = VIDEO_HOSTS.map((h) => `https://${h}`).join(" ");

  // Our infra (CF Worker proxy, CDN, BunnyNet for hosted assets).
  const INFRA = "https://*.workers.dev https://cdn.iku.gg https://*.b-cdn.net";

  // Analytics + push notifications (the only third-party scripts left).
  // Yandex Metrica (counter 109826109) added 2026-06-13 — feeds the
  // behavioral signals (dwell/CTR/Webvisor) that dominate Yandex ranking,
  // and speeds Yandex crawl. tag.js loads from mc.yandex.ru; beacons +
  // Webvisor session-replay uploads go to mc.yandex.ru / mc.yandex.com.
  const ANALYTICS =
    "https://us-assets.i.posthog.com https://us.i.posthog.com https://cdn.onesignal.com https://*.onesignal.com https://onesignal.com https://mc.yandex.ru https://mc.yandex.com https://*.mc.yandex.ru https://yastatic.net";

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
    "https://ss.mrmnd.com https://*.mrmnd.com https://mrmnd.com https://klmmnd.com https://*.klmmnd.com https://cckmnd.com https://*.cckmnd.com https://atmndx.com https://*.atmndx.com";
  const AD_SCRIPT = `${HILLTOPADS_HOSTS} ${CR_HOSTS} ${MONDIAD_HOSTS}`;

  // `'unsafe-inline'` + `'unsafe-eval'` kept for inline JSON-LD scripts
  // and React dev tooling. Tighten later with hash-based CSP.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ANALYTICS} ${AD_SCRIPT} https://static.cloudflareinsights.com https://*.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${INFRA} ${VIDEO_HOSTS_HTTPS} ${CR_HOSTS} ${MONDIAD_HOSTS} https://mc.yandex.ru https://mc.yandex.com`,
    `media-src 'self' blob: ${INFRA} ${VIDEO_HOSTS_HTTPS} ${HILLTOPADS_HOSTS} ${MONDIAD_HOSTS}`,
    `connect-src 'self' ${ANALYTICS} ${INFRA} ${VIDEO_HOSTS_HTTPS} ${AD_SCRIPT} wss://mc.yandex.ru wss://mc.yandex.com`,
    `frame-src 'self' ${HILLTOPADS_HOSTS} ${CR_HOSTS} ${MONDIAD_HOSTS}`,
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
