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
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const limiter = createRateLimiter({
  name: "forgot-password",
  max: 5,
  windowMs: 3600_000,
});

export async function POST(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests — try again later." },
      { status: 429 },
    );
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
    [email],
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
