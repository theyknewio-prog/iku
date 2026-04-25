// /md/series/[slug] — markdown listing for a series page.

import { getVideos, isBannedTag } from "@/lib/content";
import { getSeriesBySlug, type Series } from "@/data/series";
import { renderListingMarkdown } from "@/lib/markdown";
import pool from "@/lib/db";

export const revalidate = 3600;
export const dynamicParams = true;

const SITE = "https://iku.gg";

async function resolveSeries(slug: string): Promise<Series | null> {
  const existing = getSeriesBySlug(slug);
  if (existing) return existing;
  if (!slug || slug.length < 2 || slug.length > 80) return null;
  const decoded = decodeURIComponent(slug);
  if (!/^[a-z0-9_\-():%]+$/i.test(decoded)) return null;
  const candidates = Array.from(
    new Set([decoded, decoded.replace(/-/g, "_"), decoded.replace(/_/g, "-")]),
  );
  try {
    const { rows } = await pool.query<{ copyright: string; count: number }>(
      `SELECT copyright, COUNT(*)::int AS count
       FROM (SELECT unnest(copyrights) AS copyright FROM videos) t
       WHERE copyright = ANY($1::text[])
       GROUP BY copyright
       ORDER BY count DESC
       LIMIT 1`,
      [candidates],
    );
    if (rows.length === 0 || rows[0].count < 10) return null;
    const canonical = rows[0].copyright;
    const display = canonical
      .replace(/_/g, " ")
      .replace(/:/g, "")
      .trim()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      slug,
      name: display,
      description: `${display} hentai on iku.gg — ${rows[0].count.toLocaleString()} videos.`,
      tags: [canonical],
      characters: [],
      seoTitle: `${display} Hentai | iku.gg`,
      seoDescription: `Free ${display} hentai videos on iku.gg.`,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const series = await resolveSeries(slug);
  if (!series || isBannedTag(series.tags[0] || slug)) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  const { data: videos } = await getVideos({
    tags: series.tags[0],
    order: "score",
    limit: 60,
    requireThumbnail: true,
  });
  const md = renderListingMarkdown({
    title: `${series.name} — Hentai videos`,
    description: series.description,
    canonical: `${SITE}/series/${series.slug}`,
    videos,
  });
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}
