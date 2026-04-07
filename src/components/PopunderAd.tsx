"use client";

/**
 * PopunderAd — DISABLED.
 *
 * ExoClick popunder (zone 5893290) was hijacking Next.js client-side
 * navigation on SPA pages. The popunder script intercepts clicks at
 * the document level, which conflicts with React Router/Next.js Link
 * navigation, causing random page redirects.
 *
 * Revenue from popunders (~$0.50-1 CPM) is not worth destroying the
 * browsing experience. We keep the pre-roll + banners + native +
 * interstitial which together generate much more.
 *
 * If we want popunders back later, use Adsterra's popunder (28986138)
 * which may handle SPAs better, or only trigger on actual external
 * link clicks (not navigation).
 */

export function PopunderAd() {
  // Intentionally disabled — see comment above
  return null;
}
