/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 * Verifies the token, updates the password, marks token as used.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
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
      { status: 400 }
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
    [token]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const userId = Number(rows[0].user_id);
  const hash = await bcrypt.hash(newPassword, 12); // bump rounds (was 10)

  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, userId]
  );

  return NextResponse.json({ ok: true });
}
