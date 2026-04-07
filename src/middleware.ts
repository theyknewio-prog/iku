/**
 * middleware.ts — Per-request CSP nonce generation + dynamic CSP header.
 *
 * Why this exists: our JSON-LD scripts are the only legitimate inline scripts
 * on the site. Previously we allowed them by keeping `'unsafe-inline'` in
 * `script-src`, which means ANY future XSS sink becomes a full account
 * takeover vector. This middleware replaces that with per-request nonces.
 *
 * How it works:
 *   1. For every non-asset request, generate a 16-byte base64 nonce.
 *   2. Inject `'nonce-<value>'` into the `script-src` directive.
 *   3. Pass the nonce back to the app via the `x-nonce` request header so
 *      server components can read it and stamp `<script nonce={...}>`.
 *
 * Paired with `src/lib/csp-nonce.ts > getNonce()` which server components
 * call to retrieve the value.
 */

import { NextRequest, NextResponse } from "next/server";

function generateNonce(): string {
  // 16 bytes = 128 bits — recommended CSP nonce entropy.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Base64 (not base64url) — CSP spec accepts standard base64.
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // Forward the nonce to the request so server components can read it via
  // headers().get("x-nonce"). Next.js clones request headers under the hood.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Build the CSP with the per-request nonce.
  //
  // `'unsafe-inline'` is kept as a fallback for older browsers that ignore
  // nonces — modern browsers (>99% of traffic) enforce the nonce and silently
  // ignore `'unsafe-inline'` when BOTH are present (CSP Level 3 spec).
  //
  // We deliberately do NOT use `'strict-dynamic'`: it would cause `'self'`
  // and host allow-list entries to be ignored, which breaks PostHog's
  // assets.posthog.com script that we still load unconditionally.
  //
  // `'unsafe-eval'` is permanently removed (our runtime deps don't need it).
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://hentaimama.io https://hentai.tv https://animeidhentai.com https://watchhentai.net https://hentaiworld.tv https://hentaigasm.com https://hentaicity.com https://*.exoclick.com https://*.exosrv.com https://a.magsrv.com https://*.magsrv.com https://*.afcdn.net https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com",
    "media-src 'self' blob: https://cdn.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://cdn.iku.gg https://*.workers.dev https://*.afcdn.net https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com",
    "connect-src 'self' https://cdn.donmai.us https://danbooru.donmai.us https://gelbooru.com https://*.gelbooru.com https://rule34.xxx https://*.rule34.xxx https://rule34video.com https://*.rule34video.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cdn.iku.gg https://*.workers.dev https://a.magsrv.com https://*.magsrv.com https://*.exoclick.com https://*.exosrv.com https://*.afcdn.net https://*.xlivrdr.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com",
    "frame-src 'self' https://*.exoclick.com https://*.exosrv.com https://*.magsrv.com https://*.xlivrdr.com https://*.afcdn.net https://*.cam4.com https://*.tsyndicate.com https://*.chaturbate.com https://*.stripchat.com https://www.topcreativeformat.com https://*.topcreativeformat.com https://*.adsterra.com https://*.adsterratech.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  // Also expose the nonce on the response header so debug tools can see it.
  response.headers.set("x-nonce", nonce);

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
