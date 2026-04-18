/**
 * GET /api/auth/verify?token=xxx
 *
 * Consumes a verification token, marks the user's email as verified,
 * sends the welcome email, and redirects to /profile?verified=1.
 * On failure, redirects to /login?verify_error=1.
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { consumeVerificationToken, sendWelcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  // NEVER trust `Origin` for redirect URLs. Top-level GET navigations from
  // email clients don't send it, so it falls back to an attacker-controlled
  // value if set. Use the server-side constant (see security.md #4).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://iku.gg";

  if (!token || token.length < 32) {
    return NextResponse.redirect(
      new URL("/login?verify_error=invalid", origin),
    );
  }

  const userId = await consumeVerificationToken(token);
  if (!userId) {
    return NextResponse.redirect(
      new URL("/login?verify_error=expired", origin),
    );
  }

  // Fetch user details to send welcome email
  const { rows } = await pool.query(
    `SELECT email, username FROM users WHERE id = $1`,
    [userId],
  );
  const user = rows[0];
  if (user) {
    // Fire-and-forget welcome email (don't block the redirect)
    sendWelcomeEmail({
      userId,
      email: user.email,
      username: user.username,
    }).catch((err) => console.error("welcome email failed:", err));
  }

  return NextResponse.redirect(new URL("/profile?verified=1", origin));
}
