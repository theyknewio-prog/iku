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

const ALLOWED_EVENTS = new Set<ScoreEventType>(
  Object.keys(POINTS) as ScoreEventType[]
);

// Per-user rate limit — in-memory, bounded
const rateLimit = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimit) if (now > v.resetAt) rateLimit.delete(k);
  if (rateLimit.size > 10000) {
    let i = 0;
    for (const k of rateLimit.keys()) {
      if (i++ >= rateLimit.size - 10000) break;
      rateLimit.delete(k);
    }
  }
}, 5 * 60_000);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, anon: true }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limit
  const now = Date.now();
  const rl = rateLimit.get(userId);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 30) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    rl.count++;
  } else {
    rateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
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
    stats: {
      score:          result.stats.score,
      current_streak: result.stats.current_streak,
    },
  });
}
