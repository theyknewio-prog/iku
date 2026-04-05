/**
 * POST /api/auth/resend-verification
 *
 * Allows an authenticated user whose email is not yet verified to request
 * a fresh verification email. Rate limited to 1 send per 5 minutes per user
 * to prevent inbox flooding.
 *
 * Returns 200 in three cases:
 *   - email (re)sent successfully
 *   - user is already verified (no-op, for idempotent client UX)
 *   - user has a Discord-synthetic email (exempt, can't verify)
 *
 * Returns 429 if the user hits the cooldown.
 * Returns 401 if not authenticated.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVerifyStatus } from "@/lib/email-verify-guard";
import { sendVerificationEmail } from "@/lib/email";

// user_id → timestamp of last send (epoch ms). Bounded by unique user ids
// which are bounded by active sessions — no unbounded growth risk.
const lastSend = new Map<string, number>();
const COOLDOWN_MS = 5 * 60_000;

// Periodic cleanup of stale entries (> 1h old) to cap memory.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [k, ts] of lastSend) if (ts < cutoff) lastSend.delete(k);
}, 10 * 60_000);

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const userId = String(session.user.id);

  // Cooldown
  const last = lastSend.get(userId);
  if (last && Date.now() - last < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    return NextResponse.json(
      { error: "cooldown", retry_after: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const status = await getVerifyStatus(userId);
  if (!status.email) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Already verified or exempt — idempotent success
  if (status.passed) {
    return NextResponse.json({ ok: true, already_verified: true });
  }

  // Mark the attempt first so even a silent send-fail consumes the cooldown
  // (prevents scripted retry loops).
  lastSend.set(userId, Date.now());

  const result = await sendVerificationEmail({
    userId,
    email: status.email,
    username: status.username ?? "friend",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "send_failed", detail: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
