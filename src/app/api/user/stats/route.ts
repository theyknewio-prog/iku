/**
 * GET /api/user/stats — current user's gamification profile
 * (stats + tier + next tier + progress + badges)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateUserStats,
  getUserBadges,
  tierFromScore,
  nextTierFor,
} from "@/lib/gamification";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const stats = await getOrCreateUserStats(session.user.id);
  const badges = await getUserBadges(session.user.id);
  const tier = tierFromScore(stats.score);
  const next = nextTierFor(stats.score);

  const progress = next
    ? {
        current:  stats.score - tier.threshold,
        needed:   next.threshold - tier.threshold,
        percent:  Math.min(
          100,
          Math.round(
            ((stats.score - tier.threshold) / (next.threshold - tier.threshold)) * 100
          )
        ),
      }
    : null;

  return NextResponse.json({
    stats: {
      score:           stats.score,
      total_views:     stats.total_views,
      total_completes: stats.total_completes,
      total_favorites: stats.total_favorites,
      current_streak:  stats.current_streak,
      longest_streak:  stats.longest_streak,
      streak_freezes:  stats.streak_freezes,
    },
    tier: {
      index:     tier.index,
      name:      tier.name,
      emoji:     tier.emoji,
      color:     tier.color,
      threshold: tier.threshold,
      perks:     tier.perks,
    },
    nextTier: next
      ? {
          name:      next.name,
          emoji:     next.emoji,
          threshold: next.threshold,
        }
      : null,
    progress,
    badges,
  });
}
