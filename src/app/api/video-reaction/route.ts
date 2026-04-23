/**
 * POST   /api/video-reaction   — set / toggle reaction ({ slug, reaction: "like"|"dislike" })
 * DELETE /api/video-reaction?slug=…  — clear reaction
 * GET    /api/video-reaction?slug=…  — return { mine, likes, dislikes }
 *
 * Anonymous users: likes/dislikes are persisted in localStorage only
 * (handled client-side). The auth'd endpoint stores the reaction in PG
 * so counts survive device changes and contribute to the ratio bar.
 *
 * Self-heal pattern: mirrors /api/mark-dead — CREATE TABLE IF NOT EXISTS
 * once per process so a fresh deploy doesn't need a migration step.
 *
 * Security:
 *   - slug regex validated (prevents tag/path injection)
 *   - rate limited per-user for POST/DELETE (30/min)
 *   - GET rate limited per-IP (60/min)
 *   - points awarded via recordScore (dedup logic: one like per user per
 *     video — flipping between like↔dislike does not double-pay)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { recordScore } from "@/lib/gamification";

type Reaction = "like" | "dislike";

const SLUG_RE = /^[a-z0-9-]+$/i;

let ensureTablePromise: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(
        `CREATE TABLE IF NOT EXISTS user_video_reactions (
          user_id   INTEGER NOT NULL,
          slug      TEXT NOT NULL,
          reaction  TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, slug)
        );
        CREATE INDEX IF NOT EXISTS idx_user_video_reactions_slug
          ON user_video_reactions(slug);`,
      )
      .then(() => undefined)
      .catch(() => {
        /* swallow — race-safe via IF NOT EXISTS */
      });
  }
  return ensureTablePromise;
}

const writeLimiter = createRateLimiter({
  name: "video-reaction-write",
  max: 30,
  windowMs: 60_000,
});
const readLimiter = createRateLimiter({
  name: "video-reaction-read",
  max: 60,
  windowMs: 60_000,
  maxKeys: 20_000,
});

function validateSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > 200) return null;
  if (!SLUG_RE.test(raw)) return null;
  return raw;
}

async function countReactions(
  slug: string,
): Promise<{ likes: number; dislikes: number }> {
  const { rows } = await pool.query<{ reaction: string; n: string }>(
    `SELECT reaction, COUNT(*)::text AS n
       FROM user_video_reactions WHERE slug = $1 GROUP BY reaction`,
    [slug],
  );
  let likes = 0;
  let dislikes = 0;
  for (const r of rows) {
    if (r.reaction === "like") likes = Number(r.n);
    if (r.reaction === "dislike") dislikes = Number(r.n);
  }
  return { likes, dislikes };
}

export async function GET(request: NextRequest) {
  if (readLimiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const slug = validateSlug(request.nextUrl.searchParams.get("slug"));
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  await ensureTable();

  const session = await auth();
  const userId = session?.user?.id;

  let mine: Reaction | null = null;
  if (userId) {
    const { rows } = await pool.query<{ reaction: Reaction }>(
      `SELECT reaction FROM user_video_reactions
         WHERE user_id = $1 AND slug = $2`,
      [userId, slug],
    );
    mine = rows[0]?.reaction ?? null;
  }

  const counts = await countReactions(slug);
  return NextResponse.json({ mine, ...counts });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, anon: true }, { status: 401 });
  }
  const userId = session.user.id;
  if (writeLimiter.consume(String(userId))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { slug?: unknown; reaction?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const slug = validateSlug(body.slug);
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const reaction = body.reaction;
  if (reaction !== "like" && reaction !== "dislike") {
    return NextResponse.json({ error: "invalid reaction" }, { status: 400 });
  }

  await ensureTable();

  // Read previous reaction to decide whether to award points
  const prev = await pool.query<{ reaction: Reaction }>(
    `SELECT reaction FROM user_video_reactions
       WHERE user_id = $1 AND slug = $2`,
    [userId, slug],
  );
  const previous: Reaction | null = prev.rows[0]?.reaction ?? null;

  await pool.query(
    `INSERT INTO user_video_reactions (user_id, slug, reaction)
       VALUES ($1, $2, $3)
     ON CONFLICT (user_id, slug) DO UPDATE
       SET reaction = EXCLUDED.reaction, created_at = NOW()`,
    [userId, slug, reaction],
  );

  // Only award on the FIRST reaction of either kind on this video.
  // Flipping like↔dislike does not double-pay.
  let awarded = 0;
  if (previous === null) {
    try {
      const r = await recordScore({
        userId,
        event: reaction === "like" ? "video_like" : "video_dislike",
        meta: { slug },
      });
      awarded = r.awarded;
    } catch {
      /* silent — reaction still stored */
    }
  }

  const counts = await countReactions(slug);
  return NextResponse.json({ ok: true, mine: reaction, awarded, ...counts });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, anon: true }, { status: 401 });
  }
  const userId = session.user.id;
  if (writeLimiter.consume(String(userId))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const slug = validateSlug(request.nextUrl.searchParams.get("slug"));
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  await ensureTable();
  await pool.query(
    `DELETE FROM user_video_reactions WHERE user_id = $1 AND slug = $2`,
    [userId, slug],
  );
  const counts = await countReactions(slug);
  return NextResponse.json({ ok: true, mine: null, ...counts });
}
