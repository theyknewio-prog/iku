#!/usr/bin/env npx tsx
/**
 * generate-blog-hentaicity.ts
 *
 * Generates SEO blog articles that internal-link to the 7279 new long-form
 * episodes from hentaicity + hentaigasm. One article per top tag (30-40
 * articles), each listing 12-20 /watch/ URLs.
 *
 * Why: 7279 fresh watch pages were added overnight but Google's crawler
 * needs internal links to reach them. Every new article is 15+ backlinks
 * from a SEO-optimized text page. At scale this is what pushes new /watch/
 * URLs from "in sitemap" to "indexed within 2 weeks".
 *
 * Output: src/data/blog-auto-hentaicity.ts — static const imported by
 * src/data/blog.ts. Re-run this script to regenerate when the DB grows.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/generate-blog-hentaicity.ts
 */

import { pool } from "./db";
import * as fs from "fs";
import * as path from "path";

const MIN_VIDEOS_PER_TAG = 12;
const MAX_ARTICLES = 40;
const VIDEOS_PER_ARTICLE = 18;

interface Video {
  slug: string;
  title: string;
  thumbnail: string;
  duration: number | null;
  source: string;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function humanize(tag: string): string {
  return tag
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function buildArticleContent(tag: string, videos: Video[]): string {
  const display = humanize(tag);
  const intro = `<p>Looking for the best <strong>${display.toLowerCase()} hentai</strong>? We've gathered ${videos.length} full episodes featuring ${display.toLowerCase()} scenes, all streaming free in HD on iku.gg. No sign-up, no ads-only content — just animated hentai episodes curated from our collection of 350,000+ videos.</p>
<p>Each episode is a full-length OVA or series chapter. If you're new to hentai, check out our <a href="/blog/what-is-hentai">complete guide to hentai</a> first. For short animated clips in the same genre, browse our <a href="/tag/${encodeURIComponent(tag)}">full ${display.toLowerCase()} tag</a>.</p>`;

  const listItems = videos
    .map((v) => {
      const dur = fmtDuration(v.duration);
      const durTag = dur ? ` <em style="opacity:0.7">(${dur})</em>` : "";
      return `<li><a href="/watch/${v.slug}"><strong>${v.title.replace(/</g, "&lt;")}</strong></a>${durTag}</li>`;
    })
    .join("\n");

  const list = `<h2>Top ${videos.length} ${display} Hentai Episodes</h2>\n<ul>\n${listItems}\n</ul>`;

  const outro = `<h2>Why these episodes?</h2>
<p>All episodes in this list are sourced from our long-form animated hentai collection. They run 15–30 minutes on average and cover full story arcs — not just isolated clips. If you want shorter animated loops, the <a href="/tag/${encodeURIComponent(tag)}">${display.toLowerCase()} tag</a> on iku.gg has thousands more.</p>
<p>Bookmark this page or <a href="/trending">check trending</a> for the freshest releases. We add new episodes daily via our automated ingestion pipeline — see our <a href="/blog/best-hentai-streaming-sites-2026">2026 guide to the best hentai streaming sites</a> to see why iku.gg beats every other site for long-form content.</p>`;

  return intro + "\n" + list + "\n" + outro;
}

async function main() {
  console.log("── generate-blog-hentaicity ──");

  // Get top tags from hentaicity + hentaigasm
  const { rows: tagRows } = await pool.query(
    `SELECT tag, count(*) as n
     FROM (
       SELECT unnest(tags) as tag
       FROM videos
       WHERE source IN ('hentaicity', 'hentaigasm')
     ) t
     WHERE tag NOT IN ('premium-paysites', 'hentai', 'hentai-pros', 'uncensored', 'subbed', 'english-subbed', 'eng-sub')
       AND length(tag) >= 3
     GROUP BY tag
     HAVING count(*) >= ${MIN_VIDEOS_PER_TAG}
     ORDER BY count(*) DESC
     LIMIT ${MAX_ARTICLES * 2}`,
  );
  console.log(`Found ${tagRows.length} candidate tags`);

  const articles: Array<{
    slug: string;
    tag: string;
    title: string;
    excerpt: string;
    content: string;
    count: number;
  }> = [];

  for (const { tag } of tagRows) {
    if (articles.length >= MAX_ARTICLES) break;

    const { rows: videos } = await pool.query(
      `SELECT slug, title, thumbnail, duration, source
       FROM videos
       WHERE source IN ('hentaicity', 'hentaigasm')
         AND $1 = ANY(tags)
         AND title IS NOT NULL
         AND thumbnail IS NOT NULL
         AND thumbnail <> ''
       ORDER BY score DESC, created_at DESC
       LIMIT ${VIDEOS_PER_ARTICLE}`,
      [tag]
    );

    if (videos.length < MIN_VIDEOS_PER_TAG) continue;

    const display = humanize(tag);
    const slug = `best-${slugify(tag)}-hentai-episodes-2026`;
    const title = `Best ${display} Hentai Episodes 2026 — ${videos.length} Full OVAs`;
    const excerpt = `${videos.length} full-length ${display.toLowerCase()} hentai episodes streaming free on iku.gg. Hand-picked from our 350K+ collection.`;
    const content = buildArticleContent(tag, videos);

    articles.push({
      slug,
      tag,
      title,
      excerpt,
      content,
      count: videos.length,
    });
  }

  console.log(`Generated ${articles.length} articles`);

  // Write to TypeScript file
  const outPath = path.join(process.cwd(), "src", "data", "blog-auto-hentaicity.ts");
  const now = new Date().toISOString();

  const tsContent = `// AUTO-GENERATED by scripts/generate-blog-hentaicity.ts on ${now}
// Do NOT edit by hand — re-run the generator. Merged into BLOG_ARTICLES
// via src/data/blog.ts which imports this and spreads it after the
// hand-written articles.

import type { BlogArticle } from "./blog-types";

export const BLOG_ARTICLES_HENTAICITY: BlogArticle[] = [
${articles
  .map(
    (a) => `  {
    slug: ${JSON.stringify(a.slug)},
    title: ${JSON.stringify(a.title)},
    excerpt: ${JSON.stringify(a.excerpt)},
    content: ${JSON.stringify(a.content)},
    tags: ${JSON.stringify([a.tag, "hentai", "long-form", "ova"])},
    publishedAt: ${JSON.stringify(now.slice(0, 10))},
    readingTime: ${Math.max(3, Math.ceil(a.content.length / 1000))},
    glossaryLinks: [],
    seoTitle: ${JSON.stringify(a.title)},
    seoDescription: ${JSON.stringify(a.excerpt)},
  },`,
  )
  .join("\n")}
];
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, tsContent, "utf8");
  console.log(`Wrote ${articles.length} articles to ${outPath}`);
  console.log("── done ──");
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
