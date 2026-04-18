/**
 * POST /api/unlock-video
 *
 * Free user spends gamification points to permanently unlock a single
 * Pro-gated video. Pro users don't need this — they're already unlocked
 * site-wide (handled in /api/pro-status).
 *
 * Body: { videoPk: number }
 * Response:
 *   { ok: true, remainingScore: number } on success
 *   { ok: false, reason: "auth"|"not-found"|"already"|"insufficient", needed?: number, have?: number }
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { unlockCost } from "@/lib/unlock-cost";
import { isProLocked } from "@/lib/pro-gate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "auth" }, { status: 401 });
  }

  let body: { videoPk?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-body" },
      { status: 400 },
    );
  }
  const videoPk = Number(body?.videoPk);
  if (!Number.isFinite(videoPk) || videoPk <= 0) {
    return NextResponse.json(
      { ok: false, reason: "bad-body" },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch video metadata for cost calc + lock-check.
    const { rows: vRows } = await client.query<{
      pk: number;
      duration: number | null;
      source: string;
    }>(`SELECT pk, duration, source FROM videos WHERE pk = $1 LIMIT 1`, [
      videoPk,
    ]);
    const video = vRows[0];
    if (!video) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, reason: "not-found" },
        { status: 404 },
      );
    }

    // Sanity: only allow unlock for actually Pro-gated videos.
    if (
      !isProLocked({
        duration: video.duration,
        source: video.source as never,
      })
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: true, reason: "not-locked", remainingScore: null },
        { status: 200 },
      );
    }

    // Already unlocked? Idempotent success.
    const { rows: existing } = await client.query(
      `SELECT 1 FROM user_unlocks WHERE user_id = $1 AND video_pk = $2 LIMIT 1`,
      [userId, videoPk],
    );
    if (existing.length > 0) {
      const { rows: stat } = await client.query(
        `SELECT score FROM user_stats WHERE user_id = $1`,
        [userId],
      );
      await client.query("COMMIT");
      return NextResponse.json({
        ok: true,
        reason: "already",
        remainingScore: stat[0]?.score ?? 0,
      });
    }

    const cost = unlockCost({
      duration: video.duration,
      source: video.source as never,
    });

    // Lock + check + decrement in one statement (avoids double-spend race).
    const { rows: deduct } = await client.query<{ score: number }>(
      `UPDATE user_stats
         SET score = score - $2,
             updated_at = NOW()
       WHERE user_id = $1 AND score >= $2
       RETURNING score`,
      [userId, cost],
    );
    if (deduct.length === 0) {
      // Score was insufficient — fetch current to report it.
      const { rows: stat } = await client.query(
        `SELECT score FROM user_stats WHERE user_id = $1`,
        [userId],
      );
      await client.query("ROLLBACK");
      return NextResponse.json({
        ok: false,
        reason: "insufficient",
        needed: cost,
        have: stat[0]?.score ?? 0,
      });
    }

    await client.query(
      `INSERT INTO user_unlocks (user_id, video_pk, cost_points)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, videoPk, cost],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      remainingScore: deduct[0].score,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    console.error("unlock-video error:", err);
    return NextResponse.json({ ok: false, reason: "server" }, { status: 500 });
  } finally {
    client.release();
  }
}
