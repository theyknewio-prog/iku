/**
 * taxonomy-guard.ts — shared per-IP rate limit for taxonomy pages.
 *
 * Purpose: bots that scan /tag/<random>, /character/<random>, /series/<random>
 * send hundreds of unique URLs in seconds. Each miss hits PG for a COUNT +
 * getVideos. Cache helps for repeat hits, but scanners never repeat.
 *
 * Fix: throttle per-IP across ALL taxonomy paths. 60 req/min is way above
 * any real user (one user browsing clicks ~1 page per 3-5s = 12-20/min).
 * Bots scanning 100 URLs/sec get 429'd after the first second.
 */

import { createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter({
  name: "taxonomy-page",
  max: 60,
  windowMs: 60_000,
  maxKeys: 20_000,
});

export function shouldBlockTaxonomy(ip: string): boolean {
  return limiter.consume(ip);
}
