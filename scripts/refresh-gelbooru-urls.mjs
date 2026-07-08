/**
 * refresh-gelbooru-urls.mjs — Re-query the Gelbooru API by post ID to refresh
 * stored video URLs. Our rows were scraped with video-cdn*.gelbooru.com hosts
 * that now 404 (gelbooru rotated its CDN to img*.gelbooru.com). The API returns
 * the canonical current file_url. Posts that no longer exist (API count 0) are
 * marked dead.
 *
 * Playback still needs the gelbooru.com Referer — handled by /api/video-stream.
 *
 * Rate limit: Gelbooru = 1 req/s. ~19.5K rows ≈ 5.5h. Runs as a background
 * cron. Safe to re-run (idempotent per row).
 *
 *   node refresh-gelbooru-urls.mjs [--limit N] [--dead-only]
 */
import pg from "pg";

const API_KEY = process.env.GELBOORU_API_KEY;
const USER_ID = process.env.GELBOORU_USER_ID;
const DB = process.env.DATABASE_URL;
if (!API_KEY || !USER_ID || !DB) {
  console.error("missing GELBOORU_API_KEY / GELBOORU_USER_ID / DATABASE_URL");
  process.exit(1);
}

const argLimit = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? parseInt(process.argv[i + 1]) : 0;
})();
const deadOnly = process.argv.includes("--dead-only");

const pool = new pg.Pool({ connectionString: DB });
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function idFromSlug(slug) {
  // gel-13253712-1futa → 13253712
  const m = /^gel-(\d+)-/.exec(slug);
  return m ? m[1] : null;
}

const where = deadOnly
  ? "source='gelbooru' AND dead_at IS NOT NULL"
  : "source='gelbooru' AND dead_at IS NULL";
const limitSql = argLimit > 0 ? `LIMIT ${argLimit}` : "";
const { rows } = await pool.query(
  `SELECT pk, slug, url, thumbnail FROM videos WHERE ${where} ORDER BY score DESC ${limitSql}`,
);

// Gelbooru thumbnails are hotlink-protected — store them pre-wrapped in
// /api/proxy so cards render (the proxy adds the gelbooru.com Referer).
const proxyThumb = (raw) =>
  raw ? `/api/proxy?url=${encodeURIComponent(raw)}` : "";
console.log(`refreshing ${rows.length} gelbooru rows (deadOnly=${deadOnly})`);

let updated = 0,
  same = 0,
  deleted = 0,
  err = 0;

for (let i = 0; i < rows.length; i++) {
  const { pk, slug, url, thumbnail } = rows[i];
  const id = idFromSlug(slug);
  if (!id) {
    err++;
    continue;
  }
  try {
    const api = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&id=${id}&json=1&api_key=${API_KEY}&user_id=${USER_ID}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const r = await fetch(api, {
      headers: { "User-Agent": UA },
      signal: ac.signal,
    });
    clearTimeout(t);
    const j = await r.json();
    const post = j?.post?.[0];
    if (!post || !post.file_url) {
      // Post gone from gelbooru → genuinely dead.
      await pool.query(
        "UPDATE videos SET dead_at = COALESCE(dead_at, NOW()) WHERE pk = $1",
        [pk],
      );
      deleted++;
    } else {
      // Refresh both the video URL and the (hotlink-proxied) thumbnail from
      // the current API values. Idempotent — re-runs converge.
      const freshThumb = proxyThumb(post.preview_url);
      const urlChanged = post.file_url !== url;
      const thumbChanged = freshThumb && freshThumb !== thumbnail;
      if (urlChanged || thumbChanged) {
        // Also clear dead_thumbnail_at: we just fetched a fresh thumbnail, so
        // any stale "dead thumbnail" flag from a past transient 404 must be
        // lifted or the video stays hidden despite a working thumb.
        await pool.query(
          "UPDATE videos SET url = $1, thumbnail = COALESCE(NULLIF($2,''), thumbnail), dead_at = NULL, dead_thumbnail_at = NULL WHERE pk = $3",
          [post.file_url, freshThumb, pk],
        );
        updated++;
      } else {
        await pool.query(
          "UPDATE videos SET dead_at = NULL, dead_thumbnail_at = NULL WHERE pk = $1",
          [pk],
        );
        same++;
      }
    }
  } catch {
    err++;
  }
  if (i % 200 === 0)
    console.log(
      `${i}/${rows.length} — updated ${updated} same ${same} deleted ${deleted} err ${err}`,
    );
  await new Promise((r) => setTimeout(r, 1100)); // 1 req/s (gelbooru limit)
}

console.log(
  `DONE: updated ${updated}, same ${same}, deleted ${deleted}, err ${err}`,
);
await pool.end();
