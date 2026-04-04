/**
 * resolved-urls.ts — Server-side accessor for the L2 PG cache
 * of resolved video stream URLs.
 *
 * Used by the watch page to emit <link rel="preload" as="video">
 * hints so the browser can begin fetching the video before the
 * client-side /api/resolve-video call completes.
 */

import pool from "@/lib/db";

/** Look up a cached resolved URL. Returns null if missing or expired. */
export async function getCachedResolvedUrl(pageUrl: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      "SELECT video_url FROM resolved_urls WHERE page_url = $1 AND expires_at > NOW() LIMIT 1",
      [pageUrl]
    );
    return rows[0]?.video_url ?? null;
  } catch {
    return null;
  }
}
