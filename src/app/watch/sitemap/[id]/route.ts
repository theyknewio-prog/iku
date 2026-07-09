import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Hand-rolled replacement for the Next.js sitemap.ts convention. Next's
// serializer emits <video:*> fields in the wrong order (title before
// thumbnail_loc — the XSD requires thumbnail_loc first) and does NOT escape
// XML entities in video title/description. A single scraped title containing
// "&" was fatal: Yandex stopped parsing at that line and read ~95 of 45 000
// URLs per chunk (found 2026-07-09 via Yandex Webmaster "2 errors" detail).
// Same URLs as before (/watch/sitemap/{id}.xml), referenced by robots.ts.

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;

// Only LIVE, thumbnailed videos belong in the sitemap (see robots.ts — the
// chunk count there must use the same filter).
const LIVE_FILTER = "dead_at IS NULL AND thumbnail <> ''";

// XML 1.0 forbids C0 control chars (except tab/LF/CR) and some scraped
// titles carry them — strip by code point, then escape entities.
const esc = (s: string) =>
  Array.from(s)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 || c === 9 || c === 10 || c === 13;
    })
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const humanize = (s?: string) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

function sitemapTitle(row: VideoRow): string {
  if (row.title && /[a-zA-Z]/.test(row.title)) {
    return row.title.replace(/\s+/g, " ").trim().slice(0, 95);
  }
  const char = humanize(row.characters?.[0]);
  const copy = humanize(row.copyrights?.[0]);
  let t = "Animated Hentai Video";
  if (char && copy) t = `${char} — ${copy} Hentai`;
  else if (char) t = `${char} Hentai`;
  else if (copy) t = `${copy} Hentai`;
  return t.slice(0, 95);
}

interface VideoRow {
  slug: string;
  created_at: string;
  thumbnail: string | null;
  title: string | null;
  characters: string[] | null;
  copyrights: string[] | null;
  duration: number | null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await ctx.params;
  const m = /^(\d+)\.xml$/.exec(idParam);
  if (!m) return new Response("Not found", { status: 404 });
  const id = parseInt(m[1], 10);
  const offset = id * MAX_PER_SITEMAP;

  let rows: VideoRow[] = [];
  try {
    const result = await pool.query(
      `SELECT slug, created_at, thumbnail, title, characters, copyrights, duration
       FROM videos WHERE ${LIVE_FILTER} ORDER BY pk LIMIT $1 OFFSET $2`,
      [MAX_PER_SITEMAP, offset],
    );
    rows = result.rows;
  } catch {
    rows = [];
  }

  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
  ];

  for (const row of rows) {
    const url = esc(`${SITE}/watch/${row.slug}`);
    const lastModified = row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString();

    const thumb = row.thumbnail || "";
    const videoEligible = /^https:\/\//.test(thumb);
    const title = esc(sitemapTitle(row));
    const dur =
      row.duration && row.duration > 0
        ? Math.min(28800, Math.floor(row.duration))
        : 0;

    parts.push("<url>");
    parts.push(`<loc>${url}</loc>`);
    parts.push(`<lastmod>${lastModified}</lastmod>`);
    parts.push("<changefreq>monthly</changefreq>");
    parts.push("<priority>0.6</priority>");
    if (videoEligible) {
      // XSD element order: thumbnail_loc, title, description, player_loc,
      // duration, publication_date, family_friendly. Yandex validates it.
      parts.push("<video:video>");
      parts.push(`<video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc>`);
      parts.push(`<video:title>${title}</video:title>`);
      parts.push(
        `<video:description>Watch ${title} free on iku.gg — streaming animated hentai, no signup.</video:description>`,
      );
      parts.push(`<video:player_loc>${url}</video:player_loc>`);
      if (dur) parts.push(`<video:duration>${dur}</video:duration>`);
      parts.push(
        `<video:publication_date>${lastModified}</video:publication_date>`,
      );
      parts.push("<video:family_friendly>no</video:family_friendly>");
      parts.push("</video:video>");
    }
    parts.push("</url>");
  }

  parts.push("</urlset>");

  return new Response(parts.join("\n"), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
