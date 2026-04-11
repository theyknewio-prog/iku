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

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  // Static CSP. `'unsafe-inline'` + `'unsafe-eval'` are required by the ad
  // networks (ExoClick injects inline scripts into its iframes) so nonces
  // would provide no additional protection against XSS.
  const csp = [
    "default-src 'self'",
    // Hentaigasm CDN shards (hgasm1.com through hgasm9.com) and Adsterra
    // rotating ad-server shards (the ones Playwright saw being blocked on
    // 2026-04-11) are both whitelisted across script/img/media/connect/frame
    // where they apply. CSP wildcards only work at the subdomain level, so
    // hgasm shards must be enumerated.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://www.highperformanceformat.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://*.mbjms.com https://*.imglnkx.com https://*.crakrevenue.com https://cdn.onesignal.com https://*.onesignal.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hentaimama.io https://hentai.tv https://animeidhentai.com https://watchhentai.net https://hentaiworld.tv https://hentaigasm.com https://hgasm1.com https://hgasm2.com https://hgasm3.com https://hgasm4.com https://hgasm5.com https://hgasm6.com https://hgasm7.com https://hgasm8.com https://hgasm9.com https://hentaicity.com https://*.hentaicity.com https://*.exoclick.com https://*.exosrv.com https://a.magsrv.com https://*.magsrv.com https://*.afcdn.net https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://onesignal.com https://*.onesignal.com",
    "media-src 'self' blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hgasm1.com https://hgasm2.com https://hgasm3.com https://hgasm4.com https://hgasm5.com https://hgasm6.com https://hgasm7.com https://hgasm8.com https://hgasm9.com https://*.hentaicity.com https://cdn.iku.gg https://*.workers.dev https://*.afcdn.net https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com",
    "connect-src 'self' https://cdn.donmai.us https://danbooru.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cdn.iku.gg https://*.workers.dev https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.afcdn.net https://*.xlivrdr.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://onesignal.com https://*.onesignal.com",
    "frame-src 'self' https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com https://*.xlivrdr.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://*.chaturbate.com https://*.stripchat.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com https://*.profitablecpmratenetwork.com https://*.highperformanceformat.com https://*.protrafficinspector.com https://*.pretrafficinspector.com https://*.skinnycrawlinglax.com https://*.sourshaped.com https://*.realizationnewestfangs.com https://*.hotfree123.com https://*.preferencenail.com https://a.adtng.com https://*.adtng.com https://*.hentaiprosnetwork.com",
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
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap|og-|icon|manifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
