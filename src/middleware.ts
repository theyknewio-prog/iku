/**
 * middleware.ts — Static CSP header (no per-request nonce).
 *
 * Previous version generated a per-request nonce and injected it into
 * script-src. Pages that needed to stamp <script nonce={...}> had to call
 * `headers()` via `getNonce()`, which forced dynamic rendering and broke ISR
 * on 346K+ watch pages. The security benefit was illusory anyway: the CSP
 * already contains `'unsafe-eval'` (required by ExoClick), so any XSS is
 * trivially exploitable even with nonces.
 *
 * Now: a static CSP is returned unchanged for every request. Inline scripts
 * are allowed via `'unsafe-inline'`. ISR is back on all dynamic routes.
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

// Adsterra rotating shards. Each one needs BOTH the bare domain and the
// wildcard form because CSP wildcards do not match the apex (silent bug
// in CLAUDE.md). Adsterra rotates these every few weeks — when a new
// "blocked content" white box appears, copy the missing shard here.
const ADSTERRA_HOSTS = [
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
const ADSTERRA_BARE = ADSTERRA_HOSTS.map((h) => `https://${h}`).join(" ");

export function middleware(request: NextRequest) {
  // Markdown-mirror rewrite: /watch/foo.md → /md/watch/foo (and same for
  // blog/glossary/tag/character/series). Anthropic-style convention used by
  // LLM crawlers (ChatGPT, Claude, Perplexity, Google AI Overviews).
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

  // Advertise the markdown mirror to LLM crawlers via Link header on canonical
  // pages. Format: <https://iku.gg/blog/foo.md>; rel="alternate"; type="text/markdown"
  const mdMatch = path.match(/^\/([^/]+)\/([^/]+?)\/?$/);
  if (mdMatch && MD_SECTIONS.has(mdMatch[1])) {
    response.headers.set(
      "Link",
      `<https://iku.gg/${mdMatch[1]}/${mdMatch[2]}.md>; rel="alternate"; type="text/markdown"`,
    );
  }

  // Static CSP. `'unsafe-inline'` + `'unsafe-eval'` are required by the ad
  // networks (ExoClick injects inline scripts into its iframes) so nonces
  // would provide no additional protection against XSS.
  const csp = [
    "default-src 'self'",
    // Hentaigasm CDN shards (hgasm1.com through hgasm9.com) and Adsterra
    // rotating ad-server shards are whitelisted across script/img/media/
    // connect/frame where they apply. CSP wildcards only work at the
    // subdomain level, so shards without a shared parent domain must be
    // enumerated. Adsterra rotates ~weekly — if new shards appear in the
    // Playwright console as CSP violations, add them here.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://www.highperformanceformat.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://*.wayfarerorthodox.com https://*.kettledroopingcontinuation.com ${ADSTERRA_BARE} https://selfassured-celebration.com https://*.selfassured-celebration.com https://sorrowfulpsychology.com https://*.sorrowfulpsychology.com https://difficultblock.com https://*.difficultblock.com https://nightdestruct.com https://*.nightdestruct.com https://lumbering-form.com https://*.lumbering-form.com https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://*.mbjms.com https://*.imglnkx.com https://*.crakrevenue.com https://cdn.onesignal.com https://*.onesignal.com https://creative.mavrtracktor.com https://*.mavrtracktor.com https://crxcr2.com https://*.crxcr2.com https://crxcra.com https://*.crxcra.com https://*.scptp9.com https://static.scptp9.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hentaimama.io https://hentai.tv https://animeidhentai.com https://watchhentai.net https://hentaiworld.tv https://hentaigasm.com https://hgasm1.com https://hgasm2.com https://hgasm3.com https://hgasm4.com https://hgasm5.com https://hgasm6.com https://hgasm7.com https://hgasm8.com https://hgasm9.com https://hentaicity.com https://*.hentaicity.com https://eporner.com https://*.eporner.com https://sfmcompile.club https://*.sfmcompile.club https://3dhentai.tube https://*.3dhentai.tube https://hentaiplay.net https://*.hentaiplay.net https://hentaiplanet.info https://*.hentaiplanet.info https://hentaisea.com https://*.hentaisea.com https://hentaibros.net https://*.hentaibros.net https://hentaifreak.org https://*.hentaifreak.org https://media.hentaifreak.org https://tube.hentaistream.com https://*.hentaistream.com https://i0.wp.com https://i1.wp.com https://i2.wp.com https://hentaicloud.com https://*.hentaicloud.com https://www.hentaicloud.com https://vdownload.hembed.com https://*.hembed.com https://*.exoclick.com https://*.exosrv.com https://a.magsrv.com https://*.magsrv.com https://*.bkcdn.net https://*.bxcdn.net https://*.exdynsrv.com https://*.realsrv.com https://*.afcdn.net https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://*.wayfarerorthodox.com https://*.kettledroopingcontinuation.com ${ADSTERRA_BARE} https://selfassured-celebration.com https://*.selfassured-celebration.com https://sorrowfulpsychology.com https://*.sorrowfulpsychology.com https://difficultblock.com https://*.difficultblock.com https://nightdestruct.com https://*.nightdestruct.com https://lumbering-form.com https://*.lumbering-form.com https://storageimagedisplay.com https://*.storageimagedisplay.com https://*.xlivrdr.com https://*.stripcash.com https://cdn.show-sb.com https://*.show-sb.com https://flushpersist.com https://*.flushpersist.com https://onesignal.com https://*.onesignal.com https://creative.mavrtracktor.com https://*.mavrtracktor.com https://*.imglnkx.com https://imglnkx.com https://*.mbjms.com https://t.mbjms.com`,
    "media-src 'self' blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hgasm1.com https://hgasm2.com https://hgasm3.com https://hgasm4.com https://hgasm5.com https://hgasm6.com https://hgasm7.com https://hgasm8.com https://hgasm9.com https://*.hentaicity.com https://eporner.com https://*.eporner.com https://sfmcompile.club https://*.sfmcompile.club https://3dhentai.tube https://*.3dhentai.tube https://hentaiplay.net https://*.hentaiplay.net https://hentaiplanet.info https://*.hentaiplanet.info https://hentaisea.com https://*.hentaisea.com https://gdvid.info https://*.gdvid.info https://javprovider.com https://*.javprovider.com https://na-01.javprovider.com https://pornobuono.com https://*.pornobuono.com https://vintageporno.stream https://*.vintageporno.stream https://cdn.vintageporno.stream https://media.hentaifreak.org https://*.hentaifreak.org https://streamhentai.org https://*.streamhentai.org https://cdn1.streamhentai.org https://cdn3.streamhentai.org https://hentaicloud.com https://*.hentaicloud.com https://www.hentaicloud.com https://vdownload.hembed.com https://*.hembed.com https://*.b-cdn.net https://cdn.iku.gg https://*.workers.dev https://*.afcdn.net https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com https://*.bkcdn.net https://*.bxcdn.net https://*.exdynsrv.com https://*.realsrv.com https://*.sacdnssedge.com https://*.stripcash.com https://*.xlivrdr.com https://*.adsacdn.com https://*.saawsedge.com https://silent-basis.pro https://*.silent-basis.pro https://difficultblock.com https://*.difficultblock.com https://bsnsrv.com https://*.bsnsrv.com https://hmoracle.com https://*.hmoracle.com https://cdn-player.com https://*.cdn-player.com https://*.ahcdn.com https://ahcdn.com",
    `connect-src 'self' https://cdn.donmai.us https://danbooru.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.b-cdn.net https://cdn.iku.gg https://*.workers.dev https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.bkcdn.net https://*.bxcdn.net https://*.exdynsrv.com https://*.realsrv.com https://*.afcdn.net https://*.xlivrdr.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://*.wayfarerorthodox.com https://*.kettledroopingcontinuation.com ${ADSTERRA_BARE} https://selfassured-celebration.com https://*.selfassured-celebration.com https://sorrowfulpsychology.com https://*.sorrowfulpsychology.com https://difficultblock.com https://*.difficultblock.com https://nightdestruct.com https://*.nightdestruct.com https://lumbering-form.com https://*.lumbering-form.com https://cdn.show-sb.com https://*.show-sb.com https://flushpersist.com https://*.flushpersist.com https://onesignal.com https://*.onesignal.com https://creative.mavrtracktor.com https://*.mavrtracktor.com https://*.ahcdn.com https://ahcdn.com https://crxcr2.com https://*.crxcr2.com https://crxcra.com https://*.crxcra.com https://*.scptp9.com`,
    `frame-src 'self' https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com https://*.bkcdn.net https://*.bxcdn.net https://*.exdynsrv.com https://*.realsrv.com https://*.xlivrdr.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://*.chaturbate.com https://*.stripchat.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://*.wayfarerorthodox.com https://*.kettledroopingcontinuation.com ${ADSTERRA_BARE} https://selfassured-celebration.com https://*.selfassured-celebration.com https://sorrowfulpsychology.com https://*.sorrowfulpsychology.com https://difficultblock.com https://*.difficultblock.com https://nightdestruct.com https://*.nightdestruct.com https://lumbering-form.com https://*.lumbering-form.com https://a.adtng.com https://*.adtng.com https://*.hentaiprosnetwork.com https://creative.mavrtracktor.com https://*.mavrtracktor.com https://crxcr2.com https://*.crxcr2.com https://crxcra.com https://*.crxcra.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  return response;
}

// Only run on document requests — skip static assets, API routes that don't
// render HTML, and Next.js internals. API routes set their own headers.
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they set JSON headers)
     * - _next/static (static build assets)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap*.xml, og images, manifest, icons
     */
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
