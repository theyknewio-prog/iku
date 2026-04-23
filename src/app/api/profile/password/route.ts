/**
 * POST /api/profile/password — change password for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";

// V15 / B6 (audits 2026-04-23): 5/h/user — cookie-jacking scenarios could
// brute-force currentPassword at 150ms/try otherwise.
const limiter = createRateLimiter({
  name: "pwd-change",
  max: 5,
  windowMs: 3600_000,
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (limiter.consume(session.user.id)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { currentPassword, newPassword } = (body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const { rows } = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [session.user.id],
  );
  const user = rows[0];
  if (!user || !user.password_hash) {
    return NextResponse.json(
      { error: "Cannot change password for OAuth account" },
      { status: 400 },
    );
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, session.user.id],
  );

  return NextResponse.json({ ok: true });
}
