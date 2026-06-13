import type { MetadataRoute } from "next";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;

// Only LIVE, thumbnailed videos belong in the sitemap. The catalogue holds
// ~142K dead-source videos (dead_at set) that the watch page already returns
// noindex for — listing them just burns Google's crawl budget on pages that
// will be dropped, and signals "30% of this site is low-quality" at the
// domain level. Filtering them here (count + chunks) concentrates crawl on
// the ~327K pages that can actually rank. (Google-war move, 2026-06-13.)
const LIVE_FILTER = "dead_at IS NULL AND thumbnail <> ''";

export async function generateSitemaps() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total FROM videos WHERE ${LIVE_FILTER}`,
    );
    const total = parseInt(rows[0].total, 10);
    const count = Math.ceil(total / MAX_PER_SITEMAP);
    return Array.from({ length: count }, (_, i) => ({ id: i }));
  } catch {
    // During build, PG may not be available — return a single sitemap placeholder
    return [{ id: 0 }];
  }
}

const humanize = (s?: string) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

// Build a clean ≤100-char title. Prefer the real scraped title (Latin only),
// else synthesize from character/copyright. Mirrors seo.ts intent but kept
// dependency-free + cheap for 45K-row sitemap generation.
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

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = parseInt(idStr, 10);
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
    // PG unavailable during build — return empty sitemap
    return [];
  }

  return rows.map((row) => {
    const url = `${SITE}/watch/${row.slug}`;
    const lastModified = row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString();

    // Video sitemap extension — turns watch URLs into video-search-eligible
    // entries (Bing/Yandex/Google video results) for a video-first site.
    // Only emit when the thumbnail is a crawlable absolute https URL; an
    // invalid thumbnail_loc would warn the whole video entry out.
    const thumb = row.thumbnail || "";
    const videoEligible = /^https:\/\//.test(thumb);
    const title = sitemapTitle(row);
    const dur =
      row.duration && row.duration > 0
        ? Math.min(28800, Math.floor(row.duration))
        : undefined;

    return {
      url,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(videoEligible
        ? {
            videos: [
              {
                title,
                thumbnail_loc: thumb,
                description:
                  `Watch ${title} free on iku.gg — streaming animated hentai, no signup.`.slice(
                    0,
                    500,
                  ),
                player_loc: url,
                publication_date: lastModified,
                family_friendly: "no" as const,
                ...(dur ? { duration: dur } : {}),
              },
            ],
          }
        : {}),
    };
  });
}
