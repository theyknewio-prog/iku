/**
 * POST /api/auth/forgot-password
 *
 * Body: { email }
 * Sends a password reset email if the account exists. Always returns success
 * (to prevent email enumeration attacks).
 *
 * Rate limited: 5 requests / hour / IP.
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

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
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";

  const now = Date.now();
  const rl = rateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return NextResponse.json(
        { error: "Too many requests — try again later." },
        { status: 429 }
      );
    }
    rl.count++;
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = (body ?? {}) as { email?: string };
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Look up user — but NEVER reveal if the email exists or not
  const { rows } = await pool.query(
    `SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );

  if (rows.length > 0) {
    const user = rows[0];
    // Fire-and-forget — don't block on SMTP
    sendPasswordResetEmail({
      userId: user.id,
      email: user.email,
      username: user.username,
    }).catch((err) => console.error("password reset email failed:", err));
  }

  // Always return success (anti-enumeration)
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
