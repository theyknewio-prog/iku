/**
 * pro-gate.ts — determines if a video is locked behind Pro subscription.
 *
 * Strategy (2026-04-13): lock only long-form "episode" content. Shorts,
 * clips and the /feed stay free so organic SEO traffic and algorithmic
 * feed stickiness are untouched. The gate applies to:
 *   - source in ('hentaicity', 'hentaigasm') → full episodes
 *   - any video with duration >= 20min (1200s) → feature-length
 *
 * This mirrors the OnlyFans/Hentai Haven pattern: free preview catalog
 * drives traffic, premium depth drives subscription. Empirically the
 * highest-revenue gate point.
 */

import type { Video } from "@/types/video";

const LONG_FORM_MIN_DURATION = 1200; // 20 minutes
const LOCKED_SOURCES = new Set(["hentaicity", "hentaigasm"]);

/**
 * Pure predicate, safe to import from client components.
 * Keep the server-only `isUserPro` in `pro-gate-server.ts` so Turbopack
 * doesn't drag pg into the browser bundle (caught the build 2026-04-13).
 */
export function isProLocked(
  video: Pick<Video, "duration" | "source">,
): boolean {
  if (LOCKED_SOURCES.has(video.source)) return true;
  if (video.duration && video.duration >= LONG_FORM_MIN_DURATION) return true;
  return false;
}
