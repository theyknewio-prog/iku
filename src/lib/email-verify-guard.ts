/**
 * email-verify-guard.ts — server-side helpers to enforce email verification.
 *
 * Used by API routes (checkout, favorites bulk) and server pages (profile,
 * pricing) to decide whether a given user should be blocked until they
 * confirm their email address.
 *
 * Discord OAuth users with a synthetic `@discord.iku.gg` email are treated
 * as exempt (they cannot receive or verify such an email anyway).
 */

import pool from "@/lib/db";

export interface VerifyStatus {
  /** True if the user is allowed to proceed (verified, or exempt). */
  passed: boolean;
  /** The user's current email, or null if the user doesn't exist. */
  email: string | null;
  /** The user's username. */
  username: string | null;
  /** Whether DB has email_verified = TRUE. */
  emailVerified: boolean;
  /** True for @discord.iku.gg synthetic emails — they can't verify. */
  isOAuthSynthetic: boolean;
}

/**
 * Look up the verification status for a user id. Returns `passed = true`
 * when the user can bypass the gate (verified, or Discord-synthetic email).
 */
export async function getVerifyStatus(
  userId: number | string,
): Promise<VerifyStatus> {
  const { rows } = await pool.query(
    `SELECT email, username, email_verified FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    return {
      passed: false,
      email: null,
      username: null,
      emailVerified: false,
      isOAuthSynthetic: false,
    };
  }

  const email: string = row.email ?? "";
  const isOAuthSynthetic = email.endsWith("@discord.iku.gg");
  const emailVerified = Boolean(row.email_verified);

  return {
    passed: emailVerified || isOAuthSynthetic,
    email,
    username: row.username ?? null,
    emailVerified,
    isOAuthSynthetic,
  };
}
