/**
 * History sync API — mirror of /api/favorites but for watch history.
 *   GET    /api/history
 *   POST   /api/history  { slug }            → upsert watched_at = NOW()
 *   POST   /api/history  { bulk: [...] }     → bulk import (first login)
 *   DELETE /api/history                      → clear all
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT video_slug AS slug, watched_at
     FROM user_history
     WHERE user_id = $1
     ORDER BY watched_at DESC
     LIMIT 500`,
    [session.user.id],
  );

  return NextResponse.json({ history: rows });
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
    const slugs = bulk
      .filter((s) => typeof s === "string" && s.length > 0 && s.length <= 200)
      .slice(0, 500);
    if (slugs.length === 0) return NextResponse.json({ ok: true });

    const values = slugs.map((_, i) => `($1, $${i + 2})`).join(",");
    await pool.query(
      `INSERT INTO user_history (user_id, video_slug) VALUES ${values}
       ON CONFLICT (user_id, video_slug) DO UPDATE SET watched_at = NOW()`,
      [session.user.id, ...slugs],
    );
    return NextResponse.json({ ok: true });
  }

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO user_history (user_id, video_slug) VALUES ($1, $2)
     ON CONFLICT (user_id, video_slug) DO UPDATE SET watched_at = NOW()`,
    [session.user.id, slug],
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await pool.query(`DELETE FROM user_history WHERE user_id = $1`, [
    session.user.id,
  ]);
  return NextResponse.json({ ok: true });
}
