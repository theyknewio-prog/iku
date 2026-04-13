/**
 * GET /api/pro-status — tiny endpoint for client components to check
 * whether the current user has an active Pro entitlement. Needed
 * because the watch page is ISR-cached (24h) and we can't bake
 * per-user state into it.
 *
 * Response: { signedIn: boolean, pro: boolean }
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUserPro } from "@/lib/pro-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  const pro = await isUserPro(userId);
  return NextResponse.json(
    { signedIn: !!userId, pro },
    {
      headers: {
        // Never cache — this is per-user state.
        "Cache-Control": "private, no-store",
      },
    }
  );
}
