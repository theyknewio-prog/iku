/**
 * GET /feed.xml — RSS 2.0 feed of the 100 latest videos.
 *
 * Many indexing services and search engine crawlers consume RSS feeds
 * to discover fresh content (Bing, Yandex, NewsNow, IFTTT, RSS readers).
 * Free signal that costs us a single PG query per request, cached 1h.
 */

import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const SITE = "https://iku.gg";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { rows } = await pool.query<{
    slug: string;
    title: string | null;
    characters: string[];
    tags: string[];
    thumbnail: string;
    created_at: Date;
  }>(
    `SELECT slug, title, characters, tags, thumbnail, created_at
     FROM videos
     WHERE thumbnail IS NOT NULL AND thumbnail <> ''
     ORDER BY created_at DESC
     LIMIT 100`
  );

  const items = rows
    .map((v) => {
      const titleBase =
        v.title ||
        v.characters?.[0] ||
        v.tags?.[0] ||
        v.slug;
      const title = escapeXml(`${titleBase} — Hentai`);
      const url = `${SITE}/watch/${v.slug}`;
      const desc = escapeXml(
        `Watch ${titleBase} hentai video on iku.gg. Tags: ${(v.tags || []).slice(0, 5).join(", ")}.`
      );
      const pubDate = new Date(v.created_at).toUTCString();
      return `
    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      <enclosure url="${escapeXml(v.thumbnail)}" type="image/jpeg" />
    </item>`;
    })
    .join("");

  const lastBuild = rows[0]
    ? new Date(rows[0].created_at).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>iku.gg — Latest Hentai &amp; 3D Cartoon Porn</title>
    <link>${SITE}/</link>
    <description>The 100 most recent uploads on iku.gg — free animated hentai, 3D cartoon porn, Genshin/Overwatch/Blue Archive compilations and HMV. Updated daily.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
