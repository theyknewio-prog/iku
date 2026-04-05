/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 * Verifies the token, updates the password, marks token as used.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { markPasswordResetTokenUsed } from "@/lib/email";

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

  // Find valid unused token (not expired)
  const { rows } = await pool.query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const userId = Number(rows[0].user_id);
  const hash = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, userId]
  );

  await markPasswordResetTokenUsed(token);

  return NextResponse.json({ ok: true });
}
