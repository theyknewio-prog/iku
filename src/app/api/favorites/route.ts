/**
 * Favorites sync API
 *   GET    /api/favorites              → list user's favorite slugs
 *   POST   /api/favorites               { slug }              → add
 *   POST   /api/favorites  { bulk: [slug1, slug2, ...] }      → bulk upsert (used on first login)
 *   DELETE /api/favorites?slug=...     → remove one
 *   DELETE /api/favorites?all=1        → remove all for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { getVerifyStatus } from "@/lib/email-verify-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT video_slug AS slug, created_at
     FROM user_favorites
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 500`,
    [session.user.id],
  );

  return NextResponse.json({ favorites: rows });
}

export async function POST(request: NextRequest) {
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

  const { slug, bulk } = (body ?? {}) as { slug?: string; bulk?: string[] };

  if (Array.isArray(bulk)) {
    // Bulk migration requires a verified email (anti-abuse: spam signups
    // could mass-import garbage slugs before the account is confirmed).
    const vStatus = await getVerifyStatus(session.user.id);
    if (!vStatus.passed) {
      return NextResponse.json(
        {
          error: "email_not_verified",
          message: "Verify your email to sync favorites.",
        },
        { status: 403 },
      );
    }

    // Bulk upsert (first-login localStorage migration). Cap to avoid abuse.
    const slugs = bulk
      .filter((s) => typeof s === "string" && s.length > 0 && s.length <= 200)
      .slice(0, 500);
    if (slugs.length === 0) return NextResponse.json({ ok: true, added: 0 });

    const values = slugs.map((_, i) => `($1, $${i + 2})`).join(",");
    await pool.query(
      `INSERT INTO user_favorites (user_id, video_slug) VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [session.user.id, ...slugs],
    );
    return NextResponse.json({ ok: true, added: slugs.length });
  }

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO user_favorites (user_id, video_slug) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [session.user.id, slug],
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const all = url.searchParams.get("all");

  if (all === "1") {
    // Bulk clear — replaces the old client pattern of firing N concurrent
    // DELETE requests that risked 429 and left partial state.
    await pool.query(`DELETE FROM user_favorites WHERE user_id = $1`, [
      session.user.id,
    ]);
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  await pool.query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND video_slug = $2`,
    [session.user.id, slug],
  );

  return NextResponse.json({ ok: true });
}
