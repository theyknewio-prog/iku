/**
 * POST /api/score
 *
 * Records a scoring event for the current authenticated user.
 * Anonymous users are silently ignored (returns 401, client fires-and-forgets).
 *
 * Body: { event: "video_view" | "video_complete" | "favorite_add" | ..., meta?: {...} }
 *
 * Rate limited: 30/min/user (prevents point farming via button mashing).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordScore, POINTS, type ScoreEventType } from "@/lib/gamification";
import { advanceDailyQuests } from "@/lib/daily-quests";
import { createRateLimiter } from "@/lib/rate-limit";

const ALLOWED_EVENTS = new Set<ScoreEventType>(
  Object.keys(POINTS) as ScoreEventType[]
);

// Per-user rate limit (anti point-farming). 30 events/min is more than enough
// for legitimate watch+favorite+quest flows.
const limiter = createRateLimiter({ name: "score", max: 30, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, anon: true }, { status: 401 });
  }

  const userId = session.user.id;
  if (limiter.consume(userId)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, meta } = (body ?? {}) as {
    event?: string;
    meta?: Record<string, unknown>;
  };

  if (!event || !ALLOWED_EVENTS.has(event as ScoreEventType)) {
    return NextResponse.json({ error: "unknown event" }, { status: 400 });
  }

  const result = await recordScore({
    userId,
    event: event as ScoreEventType,
    meta,
  });

  // Advance daily quests based on this event (no-op for events that don't match)
  // daily_quest event itself should NOT advance quests (prevents infinite loops)
  let completedQuests: Array<{ code: string; title: string; emoji: string }> = [];
  if (event !== "daily_quest") {
    completedQuests = await advanceDailyQuests(
      userId,
      event as string,
      meta as { tags?: string[] } | undefined
    );
  }

  return NextResponse.json({
    ok: true,
    awarded: result.awarded,
    newBadges: result.newBadges.map((b) => ({
      code: b.code,
      name: b.name,
      emoji: b.emoji,
      description: b.description,
    })),
    newTier: result.newTier
      ? {
          name:  result.newTier.name,
          emoji: result.newTier.emoji,
          index: result.newTier.index,
        }
      : null,
    completedQuests,
    stats: {
      score:          result.stats.score,
      current_streak: result.stats.current_streak,
    },
  });
}
