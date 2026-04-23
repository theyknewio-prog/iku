/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 * Verifies the token, updates the password, marks token as used.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// V14 / B5 (audits 2026-04-23): reset-password used to be the only auth
// route without a rate-limit — token is strong but a PG query per call
// is still a DoS primitive. 10/h/IP mirrors forgot-password.
const limiter = createRateLimiter({
  name: "reset-password",
  max: 10,
  windowMs: 3600_000,
});

export async function POST(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, newPassword } = (body ?? {}) as {
    token?: string;
    newPassword?: string;
  };

  if (!token || typeof token !== "string" || token.length < 32) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // Atomic claim: mark the token used inside the WHERE clause so two
  // concurrent requests can't both pass the "unused" check. Only the first
  // UPDATE wins; subsequent ones see rowCount=0 and return an error.
  // (See security.md #6 — previously a token race let an attacker with the
  // leaked token override a legitimate password reset in the same second.)
  const { rows } = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [token],
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  const userId = Number(rows[0].user_id);
  const hash = await bcrypt.hash(newPassword, 12); // bump rounds (was 10)

  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, userId],
  );

  return NextResponse.json({ ok: true });
}
