import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/mark-dead
 * Body: { slug: string }
 *
 * Records a "video failed to play" report from a user's browser. Fire-
 * and-forget from WatchPlayer when the <video> element errors out.
 *
 * B2 / V8 (security audit 2026-04-23): previously ANY single report
 * immediately flipped `dead_at` to NOW(). A botnet of 1000 IPs could
 * wipe the catalogue at 20 vids/min/IP. Fix: insert a row into
 * `dead_reports` and only flip `dead_at` once we see reports from 3+
 * distinct IPs (hashed, retained 7 days). Under real user traffic the
 * 3-report threshold is reached in ~hours on genuinely dead videos.
 * The background dead-video scanner (scripts/scan-dead-videos.ts) still
 * force-kills on source-side 404 regardless.
 */

const MIN_DISTINCT_REPORTS = 3;

// Best-effort self-heal: ensure the reports table exists. Cheap once per
// process (no-op after first call). Keeps the file self-contained so
// deploys don't need a separate migration step.
let ensureTablePromise: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(
        `CREATE TABLE IF NOT EXISTS dead_reports (
          slug TEXT NOT NULL,
          ip_hash TEXT NOT NULL,
          reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (slug, ip_hash)
        );
        CREATE INDEX IF NOT EXISTS idx_dead_reports_reported_at
          ON dead_reports(reported_at);`,
      )
      .then(() => undefined)
      .catch(() => {
        // Swallow — if the CREATE races with another container, the
        // IF NOT EXISTS makes it safe and INSERT below will still work.
      });
  }
  return ensureTablePromise;
}

const limiter = createRateLimiter({
  name: "mark-dead",
  max: 20,
  windowMs: 60_000,
  maxKeys: 20_000,
});

function hashIp(ip: string): string {
  // Salted SHA-256 truncated to 16 hex chars — enough entropy to avoid
  // collisions but short enough to keep the row small. Salt is fixed
  // process-wide; reports don't need to survive salt rotations.
  return createHash("sha256")
    .update(`mark-dead:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

export async function POST(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : null;
  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  await ensureTable();
  const ipHash = hashIp(getClientIp(request));

  try {
    // Record (dedupe same-IP repeat reports via primary key).
    await pool.query(
      `INSERT INTO dead_reports (slug, ip_hash) VALUES ($1, $2)
       ON CONFLICT (slug, ip_hash)
       DO UPDATE SET reported_at = NOW()`,
      [slug, ipHash],
    );

    // Count distinct IPs in the last 7 days. Flip dead_at only at the
    // threshold so a single botnet IP can't take out videos.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(DISTINCT ip_hash)::text AS n
         FROM dead_reports
         WHERE slug = $1 AND reported_at > NOW() - INTERVAL '7 days'`,
      [slug],
    );
    const distinct = Number(rows[0]?.n ?? 0);

    if (distinct >= MIN_DISTINCT_REPORTS) {
      await pool.query(
        "UPDATE videos SET dead_at = NOW() WHERE slug = $1 AND dead_at IS NULL",
        [slug],
      );
    }

    return NextResponse.json({ ok: true, reports: distinct });
  } catch (err) {
    console.error("[mark-dead] db error:", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
