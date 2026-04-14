#!/usr/bin/env node
// Full site audit — checks every URL for HTTP 200, SEO completeness, video presence.
// Runs on Hetzner host. Hits https://iku.gg through Cloudflare. Logs failures to PG.

import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE = process.env.AUDIT_BASE || "https://iku.gg";
const CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY || 10);
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "5617056258";
const TIMEOUT_MS = 30000;

async function notify(text) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });
  } catch {}
}

async function checkUrl(url, type, retry = 0) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "iku-audit/1.0" },
      redirect: "manual",
    });
    const elapsed = Date.now() - started;

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      return checkUrl(url, type, retry);
    }

    if (res.status !== 200) {
      return { url, type, status: res.status, elapsed, error: `HTTP ${res.status}`, issues: null };
    }

    const html = await res.text();
    const issues = [];

    if (!/<title>[^<]{3,}<\/title>/i.test(html)) issues.push("no-title");
    if (!/rel=["']canonical["']/i.test(html)) issues.push("no-canonical");
    if (!/property=["']og:title["']/i.test(html)) issues.push("no-og-title");
    if (!/property=["']og:image["']/i.test(html)) issues.push("no-og-image");
    if (!/name=["']description["']/i.test(html)) issues.push("no-meta-desc");

    if (type === "watch") {
      if (!/"@type"\s*:\s*"VideoObject"/.test(html)) issues.push("no-video-jsonld");
      if (!/<video[\s>]/i.test(html) && !/wp-video|WatchPlayer/.test(html)) issues.push("no-video-tag");
      if (!/"@type"\s*:\s*"BreadcrumbList"/.test(html)) issues.push("no-breadcrumb");
    }
    if (type === "tag" || type === "character" || type === "series") {
      if (!/\/watch\//.test(html)) issues.push("no-videos-listed");
    }

    return { url, type, status: 200, elapsed, error: null, issues: issues.length ? issues.join(",") : null };
  } catch (e) {
    if (retry < 1) {
      await new Promise((r) => setTimeout(r, 1500));
      return checkUrl(url, type, retry + 1);
    }
    return { url, type, status: 0, elapsed: Date.now() - started, error: String(e.message || e).slice(0, 200), issues: null };
  }
}

async function main() {
  console.log("Setting up results table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_results (
      url TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status INT NOT NULL,
      elapsed INT NOT NULL,
      error TEXT,
      issues TEXT,
      checked_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_progress (
      id INT PRIMARY KEY DEFAULT 1,
      total INT NOT NULL,
      done INT NOT NULL DEFAULT 0,
      fail INT NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `);
  await pool.query("TRUNCATE audit_results");
  await pool.query("DELETE FROM audit_progress");

  console.log("Gathering URLs...");
  const urls = [];

  const staticPages = [
    "/", "/explore", "/trending", "/new", "/browse", "/feed",
    "/tags", "/character", "/series", "/blog", "/glossary",
    "/episodes", "/hentai", "/3d", "/login", "/signup", "/favorites",
    "/history", "/settings", "/premium",
  ];
  for (const p of staticPages) urls.push({ url: `${BASE}${p}`, type: "static" });

  const watch = await pool.query("SELECT slug FROM videos");
  for (const r of watch.rows) urls.push({ url: `${BASE}/watch/${encodeURIComponent(r.slug)}`, type: "watch" });

  const tags = await pool.query(`SELECT DISTINCT unnest(tags) AS t FROM videos WHERE array_length(tags,1) > 0`);
  for (const r of tags.rows) {
    if (r.t && r.t.length <= 100) urls.push({ url: `${BASE}/tag/${encodeURIComponent(r.t)}`, type: "tag" });
  }

  const chars = await pool.query(`SELECT DISTINCT unnest(characters) AS c FROM videos WHERE array_length(characters,1) > 0`);
  for (const r of chars.rows) {
    if (r.c && r.c.length <= 100) urls.push({ url: `${BASE}/character/${encodeURIComponent(r.c)}`, type: "character" });
  }

  const series = await pool.query(`SELECT DISTINCT unnest(copyrights) AS s FROM videos WHERE array_length(copyrights,1) > 0`);
  for (const r of series.rows) {
    if (r.s && r.s.length <= 100) urls.push({ url: `${BASE}/series/${encodeURIComponent(r.s)}`, type: "series" });
  }

  console.log(`Total URLs: ${urls.length}`);
  await pool.query("INSERT INTO audit_progress (id, total, done, fail) VALUES (1, $1, 0, 0)", [urls.length]);

  await notify(
    `🔍 Full site audit started\n${urls.length.toLocaleString()} URLs\nConcurrency: ${CONCURRENCY}\nBase: ${BASE}\nETA: ${Math.round(urls.length / CONCURRENCY / 15 / 60)}h`
  );

  let done = 0;
  let fail = 0;
  const startTime = Date.now();
  let queueIdx = 0;

  async function worker() {
    while (true) {
      const idx = queueIdx++;
      if (idx >= urls.length) break;
      const item = urls[idx];
      const result = await checkUrl(item.url, item.type);
      const isFail = result.status !== 200 || result.issues;
      if (isFail) {
        fail++;
        try {
          await pool.query(
            `INSERT INTO audit_results (url, type, status, elapsed, error, issues)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (url) DO UPDATE SET status=$3, elapsed=$4, error=$5, issues=$6, checked_at=NOW()`,
            [result.url, result.type, result.status, result.elapsed, result.error, result.issues]
          );
        } catch (e) {
          console.error("PG insert err:", e.message);
        }
      }
      done++;
      if (done % 2000 === 0) {
        const pct = ((done / urls.length) * 100).toFixed(2);
        const rate = done / ((Date.now() - startTime) / 1000);
        const eta = Math.round((urls.length - done) / rate / 60);
        console.log(`[${done}/${urls.length}] ${pct}% — ${rate.toFixed(1)} req/s — ${fail} fails — ETA ${eta} min`);
        try {
          await pool.query("UPDATE audit_progress SET done=$1, fail=$2 WHERE id=1", [done, fail]);
        } catch {}
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  await pool.query("UPDATE audit_progress SET done=$1, fail=$2, finished_at=NOW() WHERE id=1", [done, fail]);

  const summary = await pool.query(`
    SELECT type,
      COUNT(*) FILTER (WHERE status != 200) AS non200,
      COUNT(*) FILTER (WHERE status = 200 AND issues IS NOT NULL) AS seo_issues,
      COUNT(*) AS total_fails
    FROM audit_results GROUP BY type ORDER BY type
  `);

  const topErrors = await pool.query(`
    SELECT error, COUNT(*) AS cnt FROM audit_results
    WHERE error IS NOT NULL GROUP BY error ORDER BY cnt DESC LIMIT 5
  `);
  const topIssues = await pool.query(`
    SELECT unnest(string_to_array(issues, ',')) AS issue, COUNT(*) AS cnt
    FROM audit_results WHERE issues IS NOT NULL
    GROUP BY issue ORDER BY cnt DESC LIMIT 10
  `);

  const elapsedMin = Math.round((Date.now() - startTime) / 1000 / 60);
  let msg = `✅ Audit done in ${elapsedMin} min\nTotal: ${urls.length.toLocaleString()}\nFails: ${fail.toLocaleString()} (${((fail / urls.length) * 100).toFixed(2)}%)\n\nBy type:\n`;
  for (const r of summary.rows) {
    msg += `${r.type}: ${r.non200} non-200, ${r.seo_issues} SEO issues\n`;
  }
  msg += `\nTop errors:\n${topErrors.rows.map((r) => `  ${r.error}: ${r.cnt}`).join("\n") || "none"}`;
  msg += `\n\nTop SEO issues:\n${topIssues.rows.map((r) => `  ${r.issue}: ${r.cnt}`).join("\n") || "none"}`;
  await notify(msg);
  console.log(msg);

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await notify(`❌ Audit crashed: ${e.message}`);
  process.exit(1);
});
