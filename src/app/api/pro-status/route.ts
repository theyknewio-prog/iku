/**
 * GET /api/pro-status — tiny endpoint for client components to check
 * whether the current user has an active Pro entitlement. Needed
 * because the watch page is ISR-cached (24h) and we can't bake
 * per-user state into it.
 *
 * Response: { signedIn: boolean, pro: boolean }
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { isUserPro } from "@/lib/pro-gate-server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const pro = await isUserPro(userId);

  // Optional per-video info: ?videoPk=123 → return unlocked + cost
  // for the gamification "spend points" flow on the watch page.
  const videoPkParam = req.nextUrl.searchParams.get("videoPk");
  let unlockedThisVideo = false;
  let score = 0;
  if (userId) {
    const { rows } = await pool.query<{ score: number }>(
      `SELECT score FROM user_stats WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    score = rows[0]?.score ?? 0;
    if (videoPkParam && /^\d+$/.test(videoPkParam)) {
      const { rows: u } = await pool.query(
        `SELECT 1 FROM user_unlocks WHERE user_id = $1 AND video_pk = $2 LIMIT 1`,
        [userId, Number(videoPkParam)],
      );
      unlockedThisVideo = u.length > 0;
    }
  }

  return NextResponse.json(
    { signedIn: !!userId, pro, score, unlockedThisVideo },
    {
      headers: {
        // Never cache — this is per-user state.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
