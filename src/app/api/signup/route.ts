/**
 * POST /api/signup
 *
 * Creates a new user via email + password.
 * Validates:
 *   - email format + uniqueness
 *   - username (3-20 chars, alphanumeric + _/-) + uniqueness
 *   - password (min 8 chars)
 *   - DOB (18+ server-side, unbypassable)
 *   - I am 18+ checkbox
 *
 * Rate limited: 5 signups / hour / IP.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

const signupRateLimit = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of signupRateLimit) {
    if (now > v.resetAt) signupRateLimit.delete(k);
  }
  if (signupRateLimit.size > 10000) {
    let i = 0;
    for (const k of signupRateLimit.keys()) {
      if (i++ >= signupRateLimit.size - 10000) break;
      signupRateLimit.delete(k);
    }
  }
}, 5 * 60_000);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

function is18Plus(dobStr: string): boolean {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  const now = new Date();
  const eighteen = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate()
  );
  return dob <= eighteen;
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";
  const now = Date.now();
  const rl = signupRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return NextResponse.json(
        { error: "Too many signup attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
    rl.count++;
  } else {
    signupRateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, username, password, dob, adult } = (body ?? {}) as {
    email?: string;
    username?: string;
    password?: string;
    dob?: string;
    adult?: boolean;
  };

  // Validation
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!username || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars (letters, numbers, _ or -)" },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!dob || !is18Plus(dob)) {
    return NextResponse.json(
      { error: "You must be 18 or older to sign up" },
      { status: 400 }
    );
  }
  if (adult !== true) {
    return NextResponse.json(
      { error: "You must confirm you are 18+" },
      { status: 400 }
    );
  }

  // Uniqueness checks (race-tolerant via UNIQUE constraint below)
  const clash = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))    AS email_taken,
       EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($2)) AS username_taken`,
    [email, username]
  );
  if (clash.rows[0].email_taken) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  if (clash.rows[0].username_taken) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  // Hash + insert
  const hash = await bcrypt.hash(password, 10);
  let newUserId: number;
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, dob, avatar_emoji)
       VALUES ($1, $2, $3, $4, '🌸')
       RETURNING id`,
      [email, username, hash, dob]
    );
    newUserId = Number(rows[0].id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Email or username already taken" },
        { status: 409 }
      );
    }
    console.error("signup error:", err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }

  // Fire-and-forget verification email (don't block signup response)
  sendVerificationEmail({
    userId: newUserId,
    email,
    username,
  }).catch((err) => console.error("verification email failed:", err));

  return NextResponse.json({ ok: true });
}
