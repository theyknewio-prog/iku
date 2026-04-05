/**
 * GET /api/user/quests — fetch today's daily quests for the current user.
 * Creates them if they don't exist yet (first call of the day).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateTodayQuests } from "@/lib/daily-quests";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const quests = await getOrCreateTodayQuests(session.user.id);
  return NextResponse.json({ quests });
}
