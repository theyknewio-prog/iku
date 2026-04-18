/**
 * migrate-json-to-pg.ts — HISTORICAL / NO LONGER RUNNABLE
 *
 * One-time migration that read the 5 legacy JSON data files and inserted them
 * into PostgreSQL. This ran once on 2026-04-04 and the source JSONs were
 * subsequently deleted from the repo (124 MB of dead weight).
 *
 * Kept for documentation only — do NOT run. If you need to re-migrate from a
 * fresh JSON dump, restore the files from git history (commits ~2026-04-03)
 * and rerun with: `DATABASE_URL=postgresql://... npx tsx scripts/migrate-json-to-pg.ts`
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const DATA_DIR = path.resolve(process.cwd(), "src/data");
const BATCH_SIZE = 1000;

function readJSON(file: string): unknown[] {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`  Skipping ${file}: ${(err as Error).message}`);
    return [];
  }
}

async function insertBatch(
  rows: Array<{
    source: string;
    source_id: number;
    slug: string;
    url: string;
    page_url: string | null;
    site: string | null;
    title: string | null;
    thumbnail: string;
    preview: string;
    score: number;
    favorites: number;
    tags: string[];
    characters: string[];
    copyrights: string[];
    artists: string[];
    width: number;
    height: number;
    file_size: number;
    duration: number | null;
    created_at: string;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const offset = i * 20;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16},$${offset + 17},$${offset + 18},$${offset + 19},$${offset + 20})`,
    );
    values.push(
      r.source,
      r.source_id,
      r.slug,
      r.url,
      r.page_url,
      r.site,
      r.title,
      r.thumbnail,
      r.preview,
      r.score,
      r.favorites,
      r.tags,
      r.characters,
      r.copyrights,
      r.artists,
      r.width,
      r.height,
      r.file_size,
      r.duration,
      r.created_at || new Date().toISOString(),
    );
  }

  const query = `
    INSERT INTO videos (source, source_id, slug, url, page_url, site, title, thumbnail, preview, score, favorites, tags, characters, copyrights, artists, width, height, file_size, duration, created_at)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (source, source_id) DO NOTHING
  `;

  const result = await pool.query(query, values);
  return result.rowCount ?? 0;
}

interface DanbooruEntry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  favorites: number;
  characters: string[];
  copyrights: string[];
  artists: string[];
  tags: string[];
  width: number;
  height: number;
  fileSize: number;
  duration: number | null;
  createdAt: string;
}

interface GelbooruEntry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  tags: string[];
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
}

interface Rule34Entry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  preview: string;
  score: number;
  tags: string[];
  width: number;
  height: number;
  createdAt: string;
}

interface R34VEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  thumbnail: string;
  duration: number;
  date: string;
}

interface WPEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  site: string;
  date: string;
  thumbnail?: string;
}

async function migrateSource(
  name: string,
  file: string,
  mapper: (entry: any) => {
    source: string;
    source_id: number;
    slug: string;
    url: string;
    page_url: string | null;
    site: string | null;
    title: string | null;
    thumbnail: string;
    preview: string;
    score: number;
    favorites: number;
    tags: string[];
    characters: string[];
    copyrights: string[];
    artists: string[];
    width: number;
    height: number;
    file_size: number;
    duration: number | null;
    created_at: string;
  },
) {
  const data = readJSON(file);
  console.log(`  ${name}: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map(mapper);
    inserted += await insertBatch(batch);
    process.stdout.write(
      `    ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (${inserted} inserted)\r`,
    );
  }
  console.log(`\n    Inserted: ${inserted}`);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  JSON → PostgreSQL Migration");
  console.log("═══════════════════════════════════════════\n");

  const client = await pool.connect();
  console.log("  Connected to PostgreSQL\n");
  client.release();

  await migrateSource("Danbooru", "videos.json", (v: DanbooruEntry) => ({
    source: "danbooru",
    source_id: v.id,
    slug: v.slug,
    url: v.url || "",
    page_url: null,
    site: null,
    title: null,
    thumbnail: v.thumbnail || "",
    preview: v.thumbnail
      ? v.thumbnail.replace("/180x180/", "/720x720/").replace(/\.jpg$/, ".webp")
      : "",
    score: v.score || 0,
    favorites: v.favorites || 0,
    tags: v.tags || [],
    characters: v.characters || [],
    copyrights: v.copyrights || [],
    artists: v.artists || [],
    width: v.width || 0,
    height: v.height || 0,
    file_size: v.fileSize || 0,
    duration: v.duration ?? null,
    created_at: v.createdAt || "",
  }));

  await migrateSource(
    "Gelbooru",
    "gelbooru-videos.json",
    (v: GelbooruEntry) => ({
      source: "gelbooru",
      source_id: v.id,
      slug: v.slug,
      url: v.url || "",
      page_url: null,
      site: null,
      title: null,
      thumbnail: v.thumbnail || "",
      preview: "",
      score: v.score || 0,
      favorites: 0,
      tags: v.tags || [],
      characters: [],
      copyrights: [],
      artists: [],
      width: v.width || 0,
      height: v.height || 0,
      file_size: v.fileSize || 0,
      duration: null,
      created_at: v.createdAt || "",
    }),
  );

  await migrateSource("Rule34", "rule34-videos.json", (v: Rule34Entry) => ({
    source: "rule34",
    source_id: v.id,
    slug: v.slug,
    url: v.url || "",
    page_url: null,
    site: null,
    title: null,
    thumbnail: v.thumbnail || "",
    preview: v.preview || "",
    score: v.score || 0,
    favorites: 0,
    tags: v.tags || [],
    characters: [],
    copyrights: [],
    artists: [],
    width: v.width || 0,
    height: v.height || 0,
    file_size: 0,
    duration: null,
    created_at: v.createdAt || "",
  }));

  await migrateSource(
    "Rule34Video",
    "rule34video-videos.json",
    (v: R34VEntry) => ({
      source: "rule34video",
      source_id: v.id,
      slug: v.slug,
      url: "",
      page_url: v.pageUrl || "",
      site: null,
      title: v.title || "",
      thumbnail: v.thumbnail || "",
      preview: v.thumbnail || "",
      score: 0,
      favorites: 0,
      tags: v.title
        ? v.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((w: string) => w.length > 2)
            .slice(0, 15)
        : [],
      characters: [],
      copyrights: [],
      artists: [],
      width: 1280,
      height: 720,
      file_size: 0,
      duration: v.duration || null,
      created_at: v.date || "",
    }),
  );

  await migrateSource("WordPress", "wp-hentai-videos.json", (v: WPEntry) => ({
    source: "wp",
    source_id: v.id,
    slug: v.slug,
    url: "",
    page_url: v.pageUrl || "",
    site: v.site || "",
    title: v.title || "",
    thumbnail: v.thumbnail || "",
    preview: "",
    score: 0,
    favorites: 0,
    tags: v.title
      ? v.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 15)
      : [],
    characters: [],
    copyrights: [],
    artists: [],
    width: 1280,
    height: 720,
    file_size: 0,
    duration: null,
    created_at: v.date || "",
  }));

  const { rows } = await pool.query(
    "SELECT source, COUNT(*) as count FROM videos GROUP BY source ORDER BY count DESC",
  );
  console.log("\n═══════════════════════════════════════════");
  console.log("  Migration complete!");
  for (const row of rows) {
    console.log(`    ${row.source}: ${row.count}`);
  }
  const totalResult = await pool.query("SELECT COUNT(*) as total FROM videos");
  console.log(`    TOTAL: ${totalResult.rows[0].total}`);
  console.log("═══════════════════════════════════════════");

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
