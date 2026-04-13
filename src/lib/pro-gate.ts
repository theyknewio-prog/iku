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

export function isProLocked(video: Pick<Video, "duration" | "source">): boolean {
  if (LOCKED_SOURCES.has(video.source)) return true;
  if (video.duration && video.duration >= LONG_FORM_MIN_DURATION) return true;
  return false;
}

/**
 * Server-side helper: returns true if the authenticated user has an
 * active Pro entitlement. Safe to call when there is no session.
 */
export async function isUserPro(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const { default: pool } = await import("@/lib/db");
  const { rows } = await pool.query<{ pro_status: string | null }>(
    `SELECT pro_status FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const status = rows[0]?.pro_status;
  return status === "active" || status === "lifetime";
}
