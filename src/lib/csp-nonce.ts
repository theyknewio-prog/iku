/**
 * csp-nonce.ts — Helper for server components to read the per-request CSP
 * nonce set by src/middleware.ts.
 *
 * Usage in a server component:
 *
 *     const nonce = await getNonce();
 *     <script
 *       type="application/ld+json"
 *       nonce={nonce}
 *       dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
 *     />
 *
 * The nonce is a 16-byte base64 string generated fresh for every request,
 * injected into the CSP script-src directive by middleware. Scripts missing
 * the matching nonce are blocked by the browser.
 */

import { headers } from "next/headers";

export async function getNonce(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-nonce") ?? undefined;
  } catch {
    // headers() can throw if called outside a request scope (e.g. build time).
    // Returning undefined is safe — the nonce is only needed for inline scripts.
    return undefined;
  }
}
