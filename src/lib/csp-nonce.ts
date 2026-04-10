/**
 * csp-nonce.ts — Stubbed to allow ISR on dynamic routes.
 *
 * PREVIOUSLY: This read a per-request nonce from the `x-nonce` header set
 * by middleware. Calling `headers()` here forced every route that called
 * getNonce() to render dynamically — which killed ISR on /watch/[slug],
 * /tag/*, /character/*, etc. The 346K watch pages were re-rendered on every
 * hit (2-4 PG queries per request, 200-500ms TTFB).
 *
 * NOW: Returns undefined unconditionally. Our CSP keeps `'unsafe-inline'` in
 * script-src (required anyway because ExoClick iframes inject inline scripts),
 * so scripts without a nonce are allowed. The nonce was never providing real
 * protection because `'unsafe-eval'` is also in the policy — any XSS would
 * already be trivially exploitable.
 *
 * Net effect: dynamic routes can use ISR again, and the CSP is unchanged
 * from the perspective of what's actually blocked.
 */

export async function getNonce(): Promise<string | undefined> {
  return undefined;
}
