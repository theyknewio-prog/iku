# PostgreSQL Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5 static JSON files (121MB) with a PostgreSQL database to cut build time from 5min to ~1min, free ~800MB of RAM, and enable instant SQL queries instead of in-memory JavaScript filtering.

**Architecture:** Single `videos` table in PostgreSQL stores all 353K+ videos from 5 sources. The app connects via `pg` (node-postgres) with a singleton connection pool. Listing pages (`getVideos()`) query PG directly instead of calling 4 external APIs. Individual watch page lookups keep live API calls for fresh URLs. Scrapers write to PG instead of JSON files. PG runs as a Docker container on the same Hetzner server, sharing the Docker network with the app.

**Tech Stack:** PostgreSQL 16 (Docker), `pg` (node-postgres), existing Next.js 16 / React 19 stack.

---

## Important Context

### What changes

- `src/lib/content.ts` — `getVideos()` queries PG instead of calling 4 external APIs; `getThumbnailForTag()` queries PG instead of looping through JSON arrays
- `src/lib/rule34video.ts` — reads from PG instead of `rule34video-videos.json`
- `src/lib/wp-hentai.ts` — reads from PG instead of `wp-hentai-videos.json`
- `src/app/watch/sitemap.ts` — queries PG for slugs instead of `fs.readFileSync`
- `src/app/robots.ts` — queries PG for video count instead of parsing JSON
- All 5 scrapers + enrich script — write to PG instead of JSON
- `Dockerfile` — remove JSON copy, add `DATABASE_URL`
- `.github/workflows/daily-scrape.yml` — scrapers connect to PG on Hetzner

### What does NOT change

- `src/lib/danbooru.ts` — still used for individual post lookup on watch page + related posts
- `src/lib/gelbooru.ts` — still used for individual post lookup on watch page
- `src/lib/rule34-search.ts` — still used for individual post lookup (via `rule34.ts`)
- `src/lib/rule34.ts` — single post lookup for watch page
- `src/app/watch/[slug]/page.tsx` — minor: `getRule34VideoPost` and `getWPHentaiPost` become async (add `await`)
- `src/types/video.ts` — add `"wp"` to source union type
- All page files (homepage, explore, trending, etc.) — they call `getVideos()` which keeps same signature
- `scripts/banned-tags.ts` — unchanged
- `src/data/blog.ts`, `glossary.ts`, `characters.ts`, `series.ts` — these are TS files, NOT JSON data, stay as-is

### Source type mapping

| Source      | Current `Video.source`   | New `Video.source` | Slug prefix                            |
| ----------- | ------------------------ | ------------------ | -------------------------------------- |
| Danbooru    | `"danbooru"`             | `"danbooru"`       | `{id}-{char}-{copy}`                   |
| Gelbooru    | `"gelbooru"`             | `"gelbooru"`       | `gel-`                                 |
| Rule34.xxx  | `"rule34"`               | `"rule34"`         | `r34-`                                 |
| Rule34Video | `"rule34video"`          | `"rule34video"`    | `r34v-`                                |
| WP sites    | `"rule34video"` (wrong!) | `"wp"`             | `hmm-`,`htv-`,`aid-`,`wh-`,`hw-`,`hg-` |

### Database connection

- **Dev:** `DATABASE_URL=postgresql://iku:iku@localhost:5432/iku`
- **Prod (Docker network):** `DATABASE_URL=postgresql://iku:STRONG_PASSWORD@postgres:5432/iku`
- **GitHub Actions (scrapers):** `DATABASE_URL=postgresql://iku:STRONG_PASSWORD@204.168.233.29:5432/iku`

---

## Task 1: Install `pg` and create connection pool

**Files:**

- Modify: `package.json`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Install pg package**

```bash
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2: Create `src/lib/db.ts`**

```typescript
/**
 * db.ts — PostgreSQL connection pool (singleton)
 *
 * Uses a global variable to survive Next.js hot reloads in dev mode.
 * In production, a single pool is shared across all requests.
 */

import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  return pool;
}

export const pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export default pool;
```

- [ ] **Step 3: Add `DATABASE_URL` to `.env.local`**

Add to `.env.local`:

```
DATABASE_URL=postgresql://iku:iku@localhost:5432/iku
```

Add to `.env.example`:

```
DATABASE_URL=postgresql://iku:iku@localhost:5432/iku
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/db.ts .env.example
git commit -m "feat: add pg connection pool for PostgreSQL migration"
```

---

## Task 2: Create database schema

**Files:**

- Create: `scripts/init-db.sql`

- [ ] **Step 1: Create `scripts/init-db.sql`**

```sql
-- PostgreSQL schema for iku.gg
-- Run: psql $DATABASE_URL -f scripts/init-db.sql

CREATE TABLE IF NOT EXISTS videos (
  -- Internal auto-increment PK (not the source ID)
  pk          SERIAL PRIMARY KEY,

  -- Source identification
  source      TEXT NOT NULL,            -- 'danbooru','gelbooru','rule34','rule34video','wp'
  source_id   INTEGER NOT NULL,         -- Original ID from the source

  -- URL and slug
  slug        TEXT NOT NULL,            -- URL slug (unique across all sources)
  url         TEXT NOT NULL DEFAULT '', -- Direct video URL (empty for rule34video/wp)
  page_url    TEXT,                     -- External page URL (rule34video/wp only)
  site        TEXT,                     -- WP sub-source: hmm, htv, aid, wh, hw, hg

  -- Metadata
  title       TEXT,                     -- Title (rule34video/wp only, NULL for booru sources)
  thumbnail   TEXT NOT NULL DEFAULT '',
  preview     TEXT NOT NULL DEFAULT '',
  score       INTEGER NOT NULL DEFAULT 0,
  favorites   INTEGER NOT NULL DEFAULT 0,

  -- Tags (PostgreSQL arrays for GIN indexing)
  tags        TEXT[] NOT NULL DEFAULT '{}',
  characters  TEXT[] NOT NULL DEFAULT '{}',
  copyrights  TEXT[] NOT NULL DEFAULT '{}',
  artists     TEXT[] NOT NULL DEFAULT '{}',

  -- Dimensions
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  file_size   INTEGER NOT NULL DEFAULT 0,
  duration    REAL,                     -- NULL if unknown

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(source, source_id),
  UNIQUE(slug)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(source);
CREATE INDEX IF NOT EXISTS idx_videos_score ON videos(score DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_favorites ON videos(favorites DESC);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_videos_characters ON videos USING GIN(characters);
CREATE INDEX IF NOT EXISTS idx_videos_copyrights ON videos USING GIN(copyrights);

-- Composite index for the most common query: list videos sorted by score with banned tag filtering
CREATE INDEX IF NOT EXISTS idx_videos_source_score ON videos(source, score DESC);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/init-db.sql
git commit -m "feat: add PostgreSQL schema for videos table"
```

---

## Task 3: Create JSON-to-PostgreSQL migration script

**Files:**

- Create: `scripts/migrate-json-to-pg.ts`

- [ ] **Step 1: Create `scripts/migrate-json-to-pg.ts`**

This script reads all 5 JSON files and inserts them into PostgreSQL in batches.

```typescript
/**
 * migrate-json-to-pg.ts
 *
 * One-time migration: reads all 5 JSON data files and inserts into PostgreSQL.
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage: DATABASE_URL=postgresql://... npx tsx scripts/migrate-json-to-pg.ts
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
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20})`,
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

async function migrateDanbooru() {
  const data = readJSON("videos.json") as DanbooruEntry[];
  console.log(`  Danbooru: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((v) => ({
      source: "danbooru",
      source_id: v.id,
      slug: v.slug,
      url: v.url || "",
      page_url: null,
      site: null,
      title: null,
      thumbnail: v.thumbnail || "",
      preview: v.thumbnail
        ? v.thumbnail
            .replace("/180x180/", "/720x720/")
            .replace(/\.jpg$/, ".webp")
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
    inserted += await insertBatch(batch);
    process.stdout.write(
      `    ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (${inserted} inserted)\r`,
    );
  }
  console.log(`\n    Inserted: ${inserted}`);
}

async function migrateGelbooru() {
  const data = readJSON("gelbooru-videos.json") as GelbooruEntry[];
  console.log(`  Gelbooru: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((v) => ({
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
    }));
    inserted += await insertBatch(batch);
    process.stdout.write(
      `    ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (${inserted} inserted)\r`,
    );
  }
  console.log(`\n    Inserted: ${inserted}`);
}

async function migrateRule34() {
  const data = readJSON("rule34-videos.json") as Rule34Entry[];
  console.log(`  Rule34: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((v) => ({
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
    inserted += await insertBatch(batch);
    process.stdout.write(
      `    ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (${inserted} inserted)\r`,
    );
  }
  console.log(`\n    Inserted: ${inserted}`);
}

async function migrateRule34Video() {
  const data = readJSON("rule34video-videos.json") as R34VEntry[];
  console.log(`  Rule34Video: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((v) => ({
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
    }));
    inserted += await insertBatch(batch);
    process.stdout.write(
      `    ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (${inserted} inserted)\r`,
    );
  }
  console.log(`\n    Inserted: ${inserted}`);
}

async function migrateWP() {
  const data = readJSON("wp-hentai-videos.json") as WPEntry[];
  console.log(`  WordPress: ${data.length} entries`);
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((v) => ({
      source: "wp",
      source_id: v.id,
      slug: v.slug,
      url: "",
      page_url: v.pageUrl || "",
      site: v.site || "",
      title: v.title || "",
      thumbnail: (v as WPEntry & { thumbnail?: string }).thumbnail || "",
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

  // Verify connection
  const client = await pool.connect();
  console.log("  Connected to PostgreSQL\n");
  client.release();

  await migrateDanbooru();
  await migrateGelbooru();
  await migrateRule34();
  await migrateRule34Video();
  await migrateWP();

  // Final count
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-json-to-pg.ts
git commit -m "feat: add JSON-to-PostgreSQL migration script"
```

---

## Task 4: Update Video type — add `"wp"` source

**Files:**

- Modify: `src/types/video.ts:47`

- [ ] **Step 1: Update source union type**

In `src/types/video.ts`, change line 47:

```typescript
// OLD:
source: "danbooru" | "gelbooru" | "rule34" | "rule34video";
// NEW:
source: "danbooru" | "gelbooru" | "rule34" | "rule34video" | "wp";
```

- [ ] **Step 2: Commit**

```bash
git add src/types/video.ts
git commit -m "feat: add 'wp' to Video source union type"
```

---

## Task 5: Rewrite `content.ts` — getVideos() + thumbnails from PG

**Files:**

- Modify: `src/lib/content.ts` (full rewrite)

This is the most critical file. `getVideos()` currently calls 4 external APIs, interleaves results, deduplicates, sorts, and filters. With PG, it becomes a single SQL query.

- [ ] **Step 1: Rewrite `src/lib/content.ts`**

```typescript
/**
 * content.ts — Unified content layer (PostgreSQL)
 *
 * All pages should import from here instead of calling source-specific modules.
 * Videos are queried from PostgreSQL instead of calling external APIs.
 */

import pool from "@/lib/db";
import type { Video, PaginatedResult } from "@/types/video";

// ---------------------------------------------------------------------------
// Global server-side content filter — CANNOT be bypassed by users.
// Removes illegal/underage content before it reaches any page or API.
// ---------------------------------------------------------------------------

const BANNED_TAGS = new Set([
  "loli",
  "lolicon",
  "lolidom",
  "loli_focus",
  "shota",
  "shotacon",
  "shotadom",
  "shota_focus",
  "child",
  "children",
  "minor",
  "underage",
  "toddler",
  "toddlercon",
  "infant",
  "young_girl",
  "young_boy",
  "child_on_child",
  "cub",
  "baby",
  "oppai_loli",
  "legal_loli",
  "elementary_school",
  "kindergarten",
  "randoseru",
]);

const BANNED_TAGS_ARRAY = Array.from(BANNED_TAGS);

/** Check if a single video contains banned content */
export function containsBannedContent(video: { tags: string[] }): boolean {
  return video.tags.some((t) => BANNED_TAGS.has(t.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Thumbnail lookup from PostgreSQL
// ---------------------------------------------------------------------------

/** Get the best thumbnail for a tag (character name, series name, etc.) from database */
export async function getThumbnailForTag(tag: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT thumbnail FROM videos
     WHERE (source = 'danbooru' OR source = 'gelbooru')
       AND thumbnail != ''
       AND ($1 = ANY(characters) OR $1 = ANY(copyrights) OR $1 = ANY(tags))
       AND NOT (tags && $2::text[])
     ORDER BY score DESC
     LIMIT 1`,
    [tag.toLowerCase(), BANNED_TAGS_ARRAY],
  );

  if (rows.length === 0 || !rows[0].thumbnail) return "";
  return rows[0].thumbnail
    .replace("/180x180/", "/720x720/")
    .replace(/\.jpg$/, ".webp");
}

/** Get thumbnails for multiple tags at once (batch) */
export async function getThumbnailsForTags(
  tags: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  // Use Promise.all for parallel queries
  await Promise.all(
    tags.map(async (tag) => {
      result[tag] = await getThumbnailForTag(tag);
    }),
  );
  return result;
}

// ---------------------------------------------------------------------------
// Main query interface
// ---------------------------------------------------------------------------

export interface GetVideosOptions {
  limit?: number;
  page?: number;
  order?: "score" | "date" | "favcount";
  tags?: string;
  source?: "all" | "danbooru" | "gelbooru";
}

/** Map a database row to a Video object */
function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.source_id as number,
    slug: row.slug as string,
    url: row.url as string,
    thumbnail: row.thumbnail as string,
    preview: row.preview as string,
    score: row.score as number,
    favorites: row.favorites as number,
    tags: (row.tags as string[]) || [],
    characters: (row.characters as string[]) || [],
    copyrights: (row.copyrights as string[]) || [],
    artists: (row.artists as string[]) || [],
    width: row.width as number,
    height: row.height as number,
    fileSize: row.file_size as number,
    duration: row.duration as number | null,
    createdAt: new Date(row.created_at as string),
    source: row.source as Video["source"],
  };
}

/**
 * Fetch videos from PostgreSQL with filtering, sorting, and pagination.
 *
 * Banned content is excluded at the SQL level (never leaves the database).
 */
export async function getVideos(
  options: GetVideosOptions = {},
): Promise<PaginatedResult<Video>> {
  const {
    limit = 20,
    page = 1,
    order = "score",
    tags = "",
    source = "all",
  } = options;

  const clampedLimit = Math.min(limit, 200);
  const offset = (page - 1) * clampedLimit;

  // Build WHERE clauses
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Banned content filter (always applied)
  conditions.push(`NOT (tags && $${paramIndex}::text[])`);
  params.push(BANNED_TAGS_ARRAY);
  paramIndex++;

  // Source filter
  if (source === "danbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("danbooru");
    paramIndex++;
  } else if (source === "gelbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("gelbooru");
    paramIndex++;
  }
  // source === "all" — no filter

  // Tag search
  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/).filter(Boolean);
    for (const term of searchTerms) {
      conditions.push(
        `($${paramIndex} = ANY(tags) OR $${paramIndex} = ANY(characters) OR $${paramIndex} = ANY(copyrights) OR (title IS NOT NULL AND title ILIKE '%' || $${paramIndex} || '%'))`,
      );
      params.push(term);
      paramIndex++;
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // ORDER BY
  const orderClause =
    order === "score"
      ? "ORDER BY score DESC, created_at DESC"
      : order === "favcount"
        ? "ORDER BY favorites DESC, score DESC"
        : "ORDER BY created_at DESC";

  // Query with LIMIT + 1 to check hasMore
  const query = `
    SELECT source, source_id, slug, url, page_url, site, title,
           thumbnail, preview, score, favorites,
           tags, characters, copyrights, artists,
           width, height, file_size, duration, created_at
    FROM videos
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(clampedLimit + 1, offset);

  const { rows } = await pool.query(query, params);
  const hasMore = rows.length > clampedLimit;
  const data = rows.slice(0, clampedLimit).map(rowToVideo);

  return { data, hasMore };
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expect: no errors related to content.ts. Other files that import the old sync `getThumbnailForTag` will now show errors because it became async — we fix those in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/lib/content.ts
git commit -m "feat: rewrite content.ts to query PostgreSQL instead of JSON/APIs"
```

---

## Task 6: Rewrite `rule34video.ts` and `wp-hentai.ts` for PostgreSQL

**Files:**

- Modify: `src/lib/rule34video.ts` (full rewrite)
- Modify: `src/lib/wp-hentai.ts` (full rewrite)

- [ ] **Step 1: Rewrite `src/lib/rule34video.ts`**

```typescript
/**
 * rule34video.ts — Data layer for rule34video.com videos (PostgreSQL)
 *
 * Video stream URLs are resolved on-demand via yt-dlp (see /api/resolve-video).
 */

import pool from "@/lib/db";
import type { Video, PaginatedResult } from "@/types/video";

function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.source_id as number,
    slug: row.slug as string,
    url: row.url as string,
    thumbnail: row.thumbnail as string,
    preview: row.preview as string,
    score: row.score as number,
    favorites: row.favorites as number,
    tags: (row.tags as string[]) || [],
    characters: (row.characters as string[]) || [],
    copyrights: (row.copyrights as string[]) || [],
    artists: (row.artists as string[]) || [],
    width: row.width as number,
    height: row.height as number,
    fileSize: row.file_size as number,
    duration: row.duration as number | null,
    createdAt: new Date(row.created_at as string),
    source: "rule34video",
  };
}

export async function getRule34VideoPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    "SELECT * FROM videos WHERE source = 'rule34video' AND source_id = $1 LIMIT 1",
    [id],
  );
  if (rows.length === 0) return null;
  return rowToVideo(rows[0]);
}

export async function getRule34VideoPageUrl(
  id: number,
): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT page_url FROM videos WHERE source = 'rule34video' AND source_id = $1 LIMIT 1",
    [id],
  );
  return rows[0]?.page_url ?? null;
}

export interface Rule34VideoSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export async function searchRule34Video(
  options: Rule34VideoSearchOptions = {},
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;
  const offset = (page - 1) * limit;

  const conditions = ["source = 'rule34video'"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/);
    for (const term of searchTerms) {
      conditions.push(
        `(title ILIKE '%' || $${paramIndex} || '%' OR $${paramIndex} = ANY(tags))`,
      );
      params.push(term);
      paramIndex++;
    }
  }

  const orderClause =
    order === "date" ? "ORDER BY created_at DESC" : "ORDER BY score DESC";

  params.push(limit + 1, offset);
  const query = `SELECT * FROM videos WHERE ${conditions.join(" AND ")} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const { rows } = await pool.query(query, params);
  const hasMore = rows.length > limit;

  return {
    data: rows.slice(0, limit).map(rowToVideo),
    hasMore,
  };
}
```

- [ ] **Step 2: Rewrite `src/lib/wp-hentai.ts`**

```typescript
/**
 * wp-hentai.ts — Data layer for WordPress-based hentai sites (PostgreSQL)
 *
 * Sources: hentaimama.io, hentai.tv, animeidhentai.com,
 * watchhentai.net, hentaiworld.tv, hentaigasm.com
 *
 * Like rule34video, these have no direct video URLs —
 * they're resolved on-demand via /api/resolve-video with yt-dlp.
 */

import pool from "@/lib/db";
import type { Video, PaginatedResult } from "@/types/video";

/** Known slug prefixes for each WP site */
const WP_PREFIXES = ["hmm", "htv", "aid", "wh", "hw", "hg"] as const;

export function isWPHentaiSlug(slug: string): boolean {
  return WP_PREFIXES.some((p) => slug.startsWith(p + "-"));
}

function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.source_id as number,
    slug: row.slug as string,
    url: row.url as string,
    thumbnail: row.thumbnail as string,
    preview: row.preview as string,
    score: row.score as number,
    favorites: row.favorites as number,
    tags: (row.tags as string[]) || [],
    characters: (row.characters as string[]) || [],
    copyrights: (row.copyrights as string[]) || [],
    artists: (row.artists as string[]) || [],
    width: row.width as number,
    height: row.height as number,
    fileSize: row.file_size as number,
    duration: row.duration as number | null,
    createdAt: new Date(row.created_at as string),
    source: "wp",
  };
}

export async function getWPHentaiPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    "SELECT * FROM videos WHERE source = 'wp' AND source_id = $1 LIMIT 1",
    [id],
  );
  if (rows.length === 0) return null;
  return rowToVideo(rows[0]);
}

export async function getWPHentaiPageUrl(id: number): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT page_url FROM videos WHERE source = 'wp' AND source_id = $1 LIMIT 1",
    [id],
  );
  return rows[0]?.page_url ?? null;
}

export interface WPHentaiSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export async function searchWPHentai(
  options: WPHentaiSearchOptions = {},
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;
  const offset = (page - 1) * limit;

  const conditions = ["source = 'wp'"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/);
    for (const term of searchTerms) {
      conditions.push(
        `(title ILIKE '%' || $${paramIndex} || '%' OR $${paramIndex} = ANY(tags))`,
      );
      params.push(term);
      paramIndex++;
    }
  }

  const orderClause =
    order === "date" ? "ORDER BY created_at DESC" : "ORDER BY score DESC";

  params.push(limit + 1, offset);
  const query = `SELECT * FROM videos WHERE ${conditions.join(" AND ")} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const { rows } = await pool.query(query, params);
  const hasMore = rows.length > limit;

  return {
    data: rows.slice(0, limit).map(rowToVideo),
    hasMore,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/rule34video.ts src/lib/wp-hentai.ts
git commit -m "feat: rewrite rule34video.ts and wp-hentai.ts for PostgreSQL"
```

---

## Task 7: Update callers — async thumbnails + await for post lookups

**Files:**

- Modify: `src/app/page.tsx` — `getThumbnailForTag` is now async
- Modify: `src/app/watch/[slug]/page.tsx` — `getRule34VideoPost`, `getWPHentaiPost`, `getRule34VideoPageUrl`, `getWPHentaiPageUrl` are now async
- Modify: `src/app/api/resolve-video/route.ts` (if it calls `getRule34VideoPageUrl` or `getWPHentaiPageUrl`)
- Modify: `src/app/api/resolve/route.ts` (if applicable)

These functions changed from sync to async. Callers need `await`.

- [ ] **Step 1: Update `src/app/page.tsx`**

Find all calls to `getThumbnailForTag(tag)` and make them `await getThumbnailForTag(tag)`. The homepage component is already `async` (server component), so adding `await` is safe.

Also update import: if `getThumbnailsForTags` is used, it's also now async.

Specific pattern to find and replace in `page.tsx`:

- `getThumbnailForTag(...)` → `await getThumbnailForTag(...)`
- `getThumbnailsForTags(...)` → `await getThumbnailsForTags(...)`

- [ ] **Step 2: Update `src/app/watch/[slug]/page.tsx`**

The watch page already uses `await` for Danbooru/Gelbooru/Rule34 calls. Add `await` for the previously-sync functions:

```typescript
// These were sync, now async — add await:
const rv = await getRule34VideoPost(id); // was: getRule34VideoPost(id)
const wv = await getWPHentaiPost(id); // was: getWPHentaiPost(id)
const pageUrl = await getRule34VideoPageUrl(id); // was: getRule34VideoPageUrl(id)
const wpUrl = await getWPHentaiPageUrl(id); // was: getWPHentaiPageUrl(id)
```

- [ ] **Step 3: Check for other callers**

```bash
npx tsc --noEmit 2>&1 | grep -i "error"
```

Fix any remaining TypeScript errors from the sync→async changes. The compiler will show exactly which files need `await` added.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/watch/[slug]/page.tsx
git commit -m "feat: update callers for async PG functions (thumbnails, post lookups)"
```

---

## Task 8: Rewrite sitemaps and robots.ts for PostgreSQL

**Files:**

- Modify: `src/app/watch/sitemap.ts` (full rewrite)
- Modify: `src/app/robots.ts` (full rewrite)

- [ ] **Step 1: Rewrite `src/app/watch/sitemap.ts`**

```typescript
import type { MetadataRoute } from "next";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;

export async function generateSitemaps() {
  const { rows } = await pool.query("SELECT COUNT(*) as total FROM videos");
  const total = parseInt(rows[0].total, 10);
  const count = Math.ceil(total / MAX_PER_SITEMAP);
  return Array.from({ length: count }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = parseInt(idStr, 10);
  const offset = id * MAX_PER_SITEMAP;

  const { rows } = await pool.query(
    "SELECT slug, created_at FROM videos ORDER BY pk LIMIT $1 OFFSET $2",
    [MAX_PER_SITEMAP, offset],
  );

  return rows.map((row) => ({
    url: `${SITE}/watch/${row.slug}`,
    lastModified: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
```

- [ ] **Step 2: Rewrite `src/app/robots.ts`**

```typescript
import type { MetadataRoute } from "next";
import pool from "@/lib/db";

async function getWatchSitemapCount(): Promise<number> {
  const MAX_PER_SITEMAP = 45000;
  const { rows } = await pool.query("SELECT COUNT(*) as total FROM videos");
  const total = parseInt(rows[0].total, 10);
  return Math.ceil(total / MAX_PER_SITEMAP);
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemapCount = await getWatchSitemapCount();

  const sitemaps: string[] = ["https://iku.gg/sitemap.xml"];

  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push(`https://iku.gg/watch/sitemap/${i}.xml`);
  }

  sitemaps.push(
    "https://iku.gg/tag/sitemap.xml",
    "https://iku.gg/character/sitemap.xml",
    "https://iku.gg/series/sitemap.xml",
  );

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/watch/",
        "/tag/",
        "/character/",
        "/series/",
        "/trending",
        "/new",
        "/tags",
        "/blog/",
        "/glossary/",
      ],
      disallow: [
        "/api/",
        "/_next/",
        "/feed",
        "/v/",
        "/favorites",
        "/history",
        "/settings",
      ],
    },
    sitemap: sitemaps,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/watch/sitemap.ts src/app/robots.ts
git commit -m "feat: rewrite sitemaps and robots.ts to query PostgreSQL"
```

---

## Task 9: Update `content.ts` getVideos() in `src/app/api/feed/route.ts`

**Files:**

- Modify: `src/app/api/feed/route.ts` — no changes needed if `getVideos()` kept the same signature

- [ ] **Step 1: Verify feed API compatibility**

Check that `src/app/api/feed/route.ts` still works. It imports `getVideos` from `@/lib/content` and calls it with `{ limit, page, order, tags, source }`. The signature is unchanged, so no code changes needed.

```bash
npx tsc --noEmit src/app/api/feed/route.ts 2>&1
```

Expected: no errors.

- [ ] **Step 2: Remove `Promise.resolve()` wrapper in old `content.ts`**

Already done in Task 5 — the new `content.ts` doesn't call `searchRule34Video()` anymore (it queries PG directly). No action needed.

---

## Task 10: Update scrapers to write to PostgreSQL

**Files:**

- Create: `scripts/db.ts` (shared pool for scrapers)
- Modify: `scripts/scrape-danbooru.ts`
- Modify: `scripts/scrape-gelbooru.ts`
- Modify: `scripts/scrape-rule34.ts`
- Modify: `scripts/scrape-rule34video.ts`
- Modify: `scripts/scrape-wp-sites.ts`
- Modify: `scripts/enrich-wp-thumbnails.ts`

- [ ] **Step 1: Create `scripts/db.ts`**

Shared database connection for all scraper scripts:

```typescript
/**
 * Shared PG pool for scraper scripts.
 * Reads DATABASE_URL from env.
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
});

/**
 * Upsert a batch of videos into PostgreSQL.
 * Uses INSERT ... ON CONFLICT (source, source_id) DO UPDATE to merge new data.
 */
export async function upsertVideos(
  rows: Array<{
    source: string;
    source_id: number;
    slug: string;
    url?: string;
    page_url?: string | null;
    site?: string | null;
    title?: string | null;
    thumbnail?: string;
    preview?: string;
    score?: number;
    favorites?: number;
    tags?: string[];
    characters?: string[];
    copyrights?: string[];
    artists?: string[];
    width?: number;
    height?: number;
    file_size?: number;
    duration?: number | null;
    created_at?: string;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const o = i * 20;
    placeholders.push(
      `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14},$${o + 15},$${o + 16},$${o + 17},$${o + 18},$${o + 19},$${o + 20})`,
    );
    values.push(
      r.source,
      r.source_id,
      r.slug,
      r.url ?? "",
      r.page_url ?? null,
      r.site ?? null,
      r.title ?? null,
      r.thumbnail ?? "",
      r.preview ?? "",
      r.score ?? 0,
      r.favorites ?? 0,
      r.tags ?? [],
      r.characters ?? [],
      r.copyrights ?? [],
      r.artists ?? [],
      r.width ?? 0,
      r.height ?? 0,
      r.file_size ?? 0,
      r.duration ?? null,
      r.created_at ?? new Date().toISOString(),
    );
  }

  const query = `
    INSERT INTO videos (source, source_id, slug, url, page_url, site, title, thumbnail, preview, score, favorites, tags, characters, copyrights, artists, width, height, file_size, duration, created_at)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (source, source_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      url = EXCLUDED.url,
      thumbnail = EXCLUDED.thumbnail,
      preview = EXCLUDED.preview,
      score = EXCLUDED.score,
      favorites = EXCLUDED.favorites,
      tags = EXCLUDED.tags,
      characters = EXCLUDED.characters,
      copyrights = EXCLUDED.copyrights,
      artists = EXCLUDED.artists,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      file_size = EXCLUDED.file_size,
      duration = EXCLUDED.duration
  `;

  const result = await pool.query(query, values);
  return result.rowCount ?? 0;
}
```

- [ ] **Step 2: Update `scripts/scrape-danbooru.ts`**

Replace the `main()` function's file-writing section. Change the end of `main()`:

```typescript
// REMOVE these lines:
//   fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
//   fs.writeFileSync(OUTPUT, JSON.stringify(all, null, 0));

// REPLACE with:
import { pool, upsertVideos } from "./db";

// In main(), after dedup and sort:
console.log(`\n  Upserting ${all.length} videos to PostgreSQL...`);
const BATCH = 500;
let upserted = 0;
for (let i = 0; i < all.length; i += BATCH) {
  const batch = all.slice(i, i + BATCH).map((v) => ({
    source: "danbooru",
    source_id: v.id,
    slug: v.slug,
    url: v.url,
    thumbnail: v.thumbnail,
    preview: v.thumbnail
      ? v.thumbnail.replace("/180x180/", "/720x720/").replace(/\.jpg$/, ".webp")
      : "",
    score: v.score,
    favorites: v.favorites,
    tags: v.tags,
    characters: v.characters,
    copyrights: v.copyrights,
    artists: v.artists,
    width: v.width,
    height: v.height,
    file_size: v.fileSize,
    duration: v.duration,
    created_at: v.createdAt,
  }));
  upserted += await upsertVideos(batch);
  process.stdout.write(
    `  ${Math.min(i + BATCH, all.length)}/${all.length} upserted\r`,
  );
}
console.log(`\n  ${upserted} videos upserted to PostgreSQL`);
await pool.end();
```

Remove the `fs` import and `OUTPUT` constant. Keep everything else (fetching, mapping, dedup) the same.

- [ ] **Step 3: Update `scripts/scrape-gelbooru.ts`**

Same pattern: replace `fs.writeFileSync` with `upsertVideos()` calls. Add import for `pool` and `upsertVideos` from `./db`.

```typescript
// In main(), replace file writing with:
console.log(`\n  Upserting ${unique.length} videos to PostgreSQL...`);
const BATCH = 500;
let upserted = 0;
for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH).map((v) => ({
    source: "gelbooru",
    source_id: v.id,
    slug: v.slug,
    url: v.url,
    thumbnail: v.thumbnail,
    score: v.score,
    tags: v.tags,
    width: v.width,
    height: v.height,
    file_size: v.fileSize,
    created_at: v.createdAt,
  }));
  upserted += await upsertVideos(batch);
  process.stdout.write(
    `  ${Math.min(i + BATCH, unique.length)}/${unique.length} upserted\r`,
  );
}
console.log(`\n  ${upserted} videos upserted to PostgreSQL`);
await pool.end();
```

Remove `fs`, `path`, `OUTPUT` imports/constants.

- [ ] **Step 4: Update `scripts/scrape-rule34.ts`**

Same pattern:

```typescript
// In main(), replace file writing with:
console.log(`\n  Upserting ${unique.length} videos to PostgreSQL...`);
const BATCH = 500;
let upserted = 0;
for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH).map((v) => ({
    source: "rule34",
    source_id: v.id,
    slug: v.slug,
    url: v.url,
    thumbnail: v.thumbnail,
    preview: v.preview,
    score: v.score,
    tags: v.tags,
    width: v.width,
    height: v.height,
    created_at: v.createdAt,
  }));
  upserted += await upsertVideos(batch);
  process.stdout.write(
    `  ${Math.min(i + BATCH, unique.length)}/${unique.length} upserted\r`,
  );
}
console.log(`\n  ${upserted} videos upserted to PostgreSQL`);
await pool.end();
```

- [ ] **Step 5: Update `scripts/scrape-rule34video.ts`**

```typescript
// In main(), replace file writing with:
console.log(`\n  Upserting ${allEntries.length} videos to PostgreSQL...`);
const BATCH = 500;
let upserted = 0;
for (let i = 0; i < allEntries.length; i += BATCH) {
  const batch = allEntries.slice(i, i + BATCH).map((v) => ({
    source: "rule34video",
    source_id: v.id,
    slug: v.slug,
    title: v.title,
    page_url: v.pageUrl,
    thumbnail: v.thumbnail,
    preview: v.thumbnail,
    duration: v.duration || null,
    created_at: v.date,
    tags: v.title
      ? v.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 15)
      : [],
  }));
  upserted += await upsertVideos(batch);
  process.stdout.write(
    `  ${Math.min(i + BATCH, allEntries.length)}/${allEntries.length} upserted\r`,
  );
}
console.log(`\n  ${upserted} videos upserted to PostgreSQL`);
await pool.end();
```

- [ ] **Step 6: Update `scripts/scrape-wp-sites.ts`**

```typescript
// In main(), replace file writing with:
console.log(`\n  Upserting ${allEntries.length} videos to PostgreSQL...`);
const BATCH = 500;
let upserted = 0;
for (let i = 0; i < allEntries.length; i += BATCH) {
  const batch = allEntries.slice(i, i + BATCH).map((v) => ({
    source: "wp",
    source_id: v.id,
    slug: v.slug,
    title: v.title,
    page_url: v.pageUrl,
    site: v.site,
    created_at: v.date,
    tags: v.title
      ? v.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 15)
      : [],
  }));
  upserted += await upsertVideos(batch);
  process.stdout.write(
    `  ${Math.min(i + BATCH, allEntries.length)}/${allEntries.length} upserted\r`,
  );
}
console.log(`\n  ${upserted} videos upserted to PostgreSQL`);
await pool.end();
```

- [ ] **Step 7: Update `scripts/enrich-wp-thumbnails.ts`**

```typescript
/**
 * enrich-wp-thumbnails.ts (PostgreSQL version)
 *
 * Fetches thumbnail URLs for WP entries that don't have one yet,
 * by scraping og:image from their page URLs.
 */

import { pool } from "./db";

const DELAY = 500;
const BATCH = 50;
const USER_AGENT = "Mozilla/5.0 (compatible; IkuBot/1.0)";

async function fetchThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogMatch =
      html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
    if (ogMatch) return ogMatch[1];

    const posterMatch = html.match(/poster="([^"]+)"/i);
    if (posterMatch) return posterMatch[1];

    const imgMatch = html.match(
      /<img[^>]+src="(https?:\/\/[^"]+(?:poster|thumb|cover|featured)[^"]*)"/i,
    );
    if (imgMatch) return imgMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function main() {
  // Get WP entries without thumbnails
  const { rows } = await pool.query(
    "SELECT pk, source_id, page_url FROM videos WHERE source = 'wp' AND (thumbnail = '' OR thumbnail IS NULL)",
  );

  console.log(`Need thumbnails: ${rows.length}`);

  let processed = 0;
  let found = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async (entry) => {
        const thumb = await fetchThumbnail(entry.page_url);
        if (thumb) {
          await pool.query("UPDATE videos SET thumbnail = $1 WHERE pk = $2", [
            thumb,
            entry.pk,
          ]);
          found++;
        }
        processed++;
      }),
    );

    process.stdout.write(
      `  ${processed}/${rows.length} processed, ${found} thumbnails found\r`,
    );
    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n\nDone: ${found}/${rows.length} thumbnails found and saved`);
  await pool.end();
}

main().catch(console.error);
```

- [ ] **Step 8: Commit**

```bash
git add scripts/db.ts scripts/scrape-danbooru.ts scripts/scrape-gelbooru.ts scripts/scrape-rule34.ts scripts/scrape-rule34video.ts scripts/scrape-wp-sites.ts scripts/enrich-wp-thumbnails.ts
git commit -m "feat: update all scrapers to write to PostgreSQL instead of JSON"
```

---

## Task 11: Update Docker infrastructure

**Files:**

- Create: `docker-compose.yml`
- Modify: `Dockerfile`
- Modify: `.github/workflows/daily-scrape.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: iku
      POSTGRES_USER: iku
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      # Expose for GitHub Actions scrapers (restrict via Hetzner firewall)
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iku"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://iku:${PG_PASSWORD}@postgres:5432/iku
      GELBOORU_API_KEY: ${GELBOORU_API_KEY}
      GELBOORU_USER_ID: ${GELBOORU_USER_ID}
      RULE34_API_KEY: ${RULE34_API_KEY}
      RULE34_USER_ID: ${RULE34_USER_ID}

volumes:
  pgdata:
```

- [ ] **Step 2: Update `Dockerfile`**

Remove the JSON data copy line and add DATABASE_URL placeholder:

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 2: Production runtime
# ============================================
FROM node:22-slim AS runner

# Install python3 + yt-dlp for on-demand video URL resolution
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip ca-certificates && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get purge -y python3-pip && \
    apt-get autoremove -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    echo "yt-dlp installed at: $(which yt-dlp)" && \
    yt-dlp --version

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
# Runtime heap: 3GB max — leave room for OS + yt-dlp + PG client on 8GB server
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Install wget for cache warmup script
RUN apt-get update -qq && apt-get install -y --no-install-recommends wget && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy standalone output (much smaller than full node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# NOTE: No more JSON data copy — videos are in PostgreSQL now
# Copy warmup script
COPY scripts/warmup.sh ./warmup.sh
RUN chmod +x warmup.sh

EXPOSE 3000

# Start server + run warmup in background to pre-populate ISR cache
CMD sh -c "node server.js & sh warmup.sh & wait"
```

Key change: removed `COPY --from=builder /app/src/data ./src/data` line.

- [ ] **Step 3: Update `.github/workflows/daily-scrape.yml`**

The scrapers now need `DATABASE_URL` to connect to PG on Hetzner. They no longer write JSON files.

```yaml
name: Daily Scrape & Content

on:
  schedule:
    - cron: "0 4 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  # Content publishing (blog, glossary) — still commits to git
  publish-content:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install tsx
        run: npm install -g tsx

      - name: Publish scheduled content
        run: tsx scripts/publish-scheduled.ts

      - name: Check for content changes
        id: content_changes
        run: |
          if git diff --quiet src/data/blog.ts src/data/glossary.ts src/data/content-queue.json 2>/dev/null; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit and push
        if: steps.content_changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/blog.ts src/data/glossary.ts src/data/content-queue.json
          git commit -m "content: publish scheduled articles [skip ci]"
          git push

  # Video scraping — writes directly to PostgreSQL on Hetzner
  scrape-videos:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Scrape Danbooru
        run: npx tsx scripts/scrape-danbooru.ts
        continue-on-error: true

      - name: Scrape Gelbooru
        run: npx tsx scripts/scrape-gelbooru.ts
        continue-on-error: true

      - name: Scrape Rule34.xxx
        run: npx tsx scripts/scrape-rule34.ts
        continue-on-error: true

      - name: Scrape Rule34Video.com
        run: npx tsx scripts/scrape-rule34video.ts
        continue-on-error: true

      - name: Scrape WordPress hentai sites
        run: npx tsx scripts/scrape-wp-sites.ts
        continue-on-error: true

      - name: Enrich WP thumbnails
        run: npx tsx scripts/enrich-wp-thumbnails.ts
        timeout-minutes: 10
        continue-on-error: true

      - name: Trigger Coolify deploy
        run: |
          curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            "http://${{ secrets.COOLIFY_HOST }}/api/v1/applications/${{ secrets.COOLIFY_APP_ID }}/restart"
```

Key changes:

- Split into two jobs: `publish-content` (git) and `scrape-videos` (PG)
- Scrapers use `DATABASE_URL` secret to connect to PG on Hetzner
- No more `git add src/data/*.json` — data goes to PG directly
- `npm ci` needed for the `pg` dependency
- No more video count node command (can query PG if needed)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml Dockerfile .github/workflows/daily-scrape.yml
git commit -m "feat: add docker-compose with PostgreSQL, update Dockerfile and CI"
```

---

## Task 12: Cleanup — remove JSON data files and update gitignore

**Files:**

- Modify: `.gitignore`
- Delete: JSON data files (after migration is verified working)

- [ ] **Step 1: Add JSON data files to `.gitignore`**

Add to `.gitignore`:

```
# Video data is now in PostgreSQL
src/data/videos.json
src/data/gelbooru-videos.json
src/data/rule34-videos.json
src/data/rule34video-videos.json
src/data/wp-hentai-videos.json
```

- [ ] **Step 2: Remove JSON files from git tracking**

```bash
git rm --cached src/data/videos.json src/data/gelbooru-videos.json src/data/rule34-videos.json src/data/rule34video-videos.json src/data/wp-hentai-videos.json
```

Note: This only removes them from git tracking. The files stay on disk for the migration script. After migration is verified, they can be deleted from disk too.

- [ ] **Step 3: Update `.gitattributes`** (remove LFS tracking)

If `.gitattributes` has a line for `rule34video-videos.json`, remove it since we no longer track this file in git.

- [ ] **Step 4: Remove `NODE_OPTIONS` from build script**

In `package.json`, the build script currently sets `--max-old-space-size=6144` because of the JSON files. With PG, the build should need much less memory. Change to:

```json
"build": "next build"
```

Keep the 6GB setting in Dockerfile for safety during the transition, but remove it from `package.json` since local builds won't need it anymore.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .gitattributes package.json
git commit -m "chore: remove JSON data files from git, update build script"
```

---

## Task 13: Deployment — set up PostgreSQL on Hetzner

This task is done manually on the server, not in code.

- [ ] **Step 1: SSH into Hetzner**

```bash
ssh root@204.168.233.29
```

- [ ] **Step 2: Create docker-compose environment**

```bash
cd /path/to/app  # or wherever Coolify stores the app
# Generate a strong password
PG_PASSWORD=$(openssl rand -base64 32)
echo "PG_PASSWORD=$PG_PASSWORD" > .env
echo "DATABASE_URL=postgresql://iku:$PG_PASSWORD@postgres:5432/iku" >> .env
echo "Save this password: $PG_PASSWORD"
```

- [ ] **Step 3: Start PostgreSQL**

```bash
docker compose up -d postgres
# Wait for health check
docker compose ps
```

- [ ] **Step 4: Run schema init**

```bash
docker compose exec postgres psql -U iku -d iku -f /docker-entrypoint-initdb.d/init.sql
```

- [ ] **Step 5: Run migration**

```bash
# From the project directory, with DATABASE_URL set:
DATABASE_URL=postgresql://iku:$PG_PASSWORD@localhost:5432/iku npx tsx scripts/migrate-json-to-pg.ts
```

- [ ] **Step 6: Verify**

```bash
docker compose exec postgres psql -U iku -d iku -c "SELECT source, COUNT(*) FROM videos GROUP BY source ORDER BY count DESC;"
```

Expected output should show ~353K total videos across 5 sources.

- [ ] **Step 7: Add `DATABASE_URL` to Coolify env vars**

In Coolify UI (http://204.168.233.29:8000), add:

```
DATABASE_URL=postgresql://iku:PASSWORD@postgres:5432/iku
```

- [ ] **Step 8: Add `DATABASE_URL` to GitHub Actions secrets**

In GitHub repo → Settings → Secrets:

```
DATABASE_URL=postgresql://iku:PASSWORD@204.168.233.29:5432/iku
```

Note: This requires PG port 5432 to be accessible from GitHub Actions runners. Configure Hetzner firewall to allow inbound TCP 5432.

- [ ] **Step 9: Deploy and verify**

Deploy via Coolify and verify:

- Homepage loads with video thumbnails
- `/watch/[slug]` pages work
- `/sitemap.xml` and `/watch/sitemap/0.xml` work
- Feed API returns videos
- No errors in container logs

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npm run build` completes in under 2 minutes (no more 6GB heap needed)
- [ ] Homepage shows trending videos with thumbnails
- [ ] `/watch/` pages load correctly for all source types (danbooru, gelbooru, rule34, r34v, wp)
- [ ] `/explore` page paginates correctly
- [ ] `/api/feed` returns videos
- [ ] `/sitemap.xml` lists all sitemap chunks
- [ ] `/watch/sitemap/0.xml` returns 45K entries
- [ ] `/robots.txt` lists correct number of sitemap chunks
- [ ] `getThumbnailForTag()` returns thumbnails for characters/series on homepage
- [ ] Banned content filtering works (no loli/shota content visible)
- [ ] Search by tag works in explore/feed
- [ ] Docker image builds successfully
- [ ] Container starts without errors
- [ ] RAM usage is lower than before (~800MB less)
