/**
 * PATCH /api/profile — update username + avatar for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const ALLOWED_AVATARS = new Set([
  "🌸",
  "🎮",
  "⚔️",
  "🧙",
  "🐉",
  "🏹",
  "😈",
  "👹",
  "🌙",
  "🤖",
  "🌿",
  "⚗️",
  "🐱",
  "🦊",
  "🧝",
  "🧛",
  "🧜",
  "👑",
  "💎",
  "🔥",
]);

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, avatar } = (body ?? {}) as {
    username?: string;
    avatar?: string;
  };

  if (!username || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars (letters, numbers, _ or -)" },
      { status: 400 },
    );
  }
  if (!avatar || !ALLOWED_AVATARS.has(avatar)) {
    return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
  }

  // Uniqueness check (excluding self)
  const clash = await pool.query(
    `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1`,
    [username, session.user.id],
  );
  if (clash.rows.length > 0) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 },
    );
  }

  await pool.query(
    `UPDATE users SET username = $1, avatar_emoji = $2, updated_at = NOW() WHERE id = $3`,
    [username, avatar, session.user.id],
  );

  return NextResponse.json({ ok: true });
}
