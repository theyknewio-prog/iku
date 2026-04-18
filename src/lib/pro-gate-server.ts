import "server-only";
import pool from "@/lib/db";

/**
 * Server-side helper: returns true if the authenticated user has an
 * active Pro entitlement. Safe to call when there is no session.
 *
 * Lives in a dedicated file (separate from pro-gate.ts) so the static
 * pg import never reaches client bundles. Turbopack would otherwise try
 * to resolve `dns` and fail.
 */
export async function isUserPro(
  userId: string | undefined | null,
): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query<{ pro_status: string | null }>(
    `SELECT pro_status FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const status = rows[0]?.pro_status;
  return status === "active" || status === "lifetime";
}
