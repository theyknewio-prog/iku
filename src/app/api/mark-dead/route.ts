import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/mark-dead
 * Body: { slug: string }
 *
 * Marks a video as dead (source removed it). Fire-and-forget from the
 * WatchPlayer when the <video> element errors out. Rate limited so bots
 * can't DoS the table. Idempotent (ON CONFLICT DO NOTHING).
 */

const limiter = createRateLimiter({
  name: "mark-dead",
  max: 20,
  windowMs: 60_000,
  maxKeys: 20_000,
});

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

  try {
    await pool.query(
      "UPDATE videos SET dead_at = NOW() WHERE slug = $1 AND dead_at IS NULL",
      [slug],
    );
  } catch (err) {
    console.error("[mark-dead] db error:", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
