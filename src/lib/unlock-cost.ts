/**
 * unlock-cost.ts — points-required-to-unlock calculator + helpers.
 *
 * Free users grind gamification points (+2 view, +5 complete, +8 fav,
 * +15 quest, see CLAUDE.md). The points balance lives in user_stats.score.
 * Free users can spend that balance to permanently unlock individual
 * Pro-gated videos — an alternative to paying 4.99€/mo for everything.
 *
 * Cost scaling is duration-based:
 *   <= 15 min →  80 points  (~ 8 quests OR 16 favorites OR 40 views)
 *   <= 30 min → 150 points  (~ 10 quests)
 *   <= 60 min → 250 points
 *   >  60 min → 400 points  (rare, full OAV releases)
 *
 * Hentaicity / hentaigasm sources have no duration metadata in PG —
 * they're treated as "long-form unknown" → 200 points (between the
 * 30 and 60 buckets, fair average for the typical episode length).
 */

import type { Video } from "@/types/video";

export function unlockCost(video: Pick<Video, "duration" | "source">): number {
  // Sources with missing duration metadata → fixed mid-tier price.
  if (
    (video.source === "hentaicity" || video.source === "hentaigasm") &&
    !video.duration
  ) {
    return 200;
  }
  const d = video.duration ?? 0;
  if (d <= 15 * 60) return 80;
  if (d <= 30 * 60) return 150;
  if (d <= 60 * 60) return 250;
  return 400;
}

export function formatPointsCost(n: number): string {
  return `${n.toLocaleString()} pts`;
}
