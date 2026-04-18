/**
 * /preview/v9 — "Awwwards Menu" variant.
 *
 * Phase 1 of the menu UX audit (2026-04-13) shipped on a single page:
 *   1. Command Palette (⌘K) — Raycast/Linear pattern
 *   2. Sticky Filter Rail — Spotify/Netflix chips
 *   3. Smart Search Autocomplete — recent + trending + fuzzy
 *   4. Collapsible Sidebar (60↔240px) — Linear ⌘\ toggle
 *   5. Hover-Reveal Labels — Figma/Slack
 *
 * This is a client component. Heavy CSS-in-JS because we don't want to
 * pollute globals.css until one of these wins the A/B.
 */

import { getVideos } from "@/lib/content";
import pool from "@/lib/db";
import { V9Shell } from "./V9Shell";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

async function getTopTags() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT t AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(tags) AS t FROM videos WHERE array_length(tags,1) > 0) x
     WHERE t <> ''
     GROUP BY t ORDER BY count DESC LIMIT 10`,
  );
  return rows;
}

async function getTopChars() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT ch AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(characters) AS ch FROM videos WHERE array_length(characters,1) > 0) x
     WHERE ch <> ''
     GROUP BY ch ORDER BY count DESC LIMIT 12`,
  );
  return rows;
}

export default async function V9() {
  const [trending, tags, chars] = await Promise.all([
    getVideos({
      limit: 18,
      order: "score",
      source: "all",
      requireThumbnail: true,
    }),
    getTopTags(),
    getTopChars(),
  ]);

  return (
    <V9Shell
      videos={trending.data.map((v) => ({
        id: v.id,
        slug: v.slug,
        title: v.characters[0] || v.tags[0] || v.slug,
        thumbnail: v.thumbnail,
        score: v.score,
        duration: v.duration,
        width: v.width,
      }))}
      tags={tags}
      chars={chars}
    />
  );
}
