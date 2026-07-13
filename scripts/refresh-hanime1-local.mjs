/**
 * refresh-hanime1-local.mjs — RUN FROM A RESIDENTIAL IP (Sab's machine).
 *
 * hanime1's hembed video tokens expire ~12h. The production server (Hetzner)
 * is Cloudflare-403'd on hanime1.com, and hanime1.me is ISP/CF-dead. Only a
 * residential IP can scrape fresh URLs. This script:
 *   1. pulls hanime1 ids from the server DB (over SSH),
 *   2. scrapes hanime1.com/watch?v=<id> locally for the fresh hembed mp4,
 *   3. pushes UPDATEs back to the server DB in batches (over SSH).
 *
 * Wire as a Windows Scheduled Task 2×/day (tokens are ~12h). If the PC is off,
 * the URLs lapse until the next run — inherent to the residential constraint.
 *
 *   node scripts/refresh-hanime1-local.mjs [--limit N]
 */
import { execFileSync } from "child_process";

const SSH = ["-o", "ConnectTimeout=10", "root@204.168.233.29"];
const DBURL = "postgresql://iku:iku_pg_2026_strong_pwd_x9k@localhost:5432/iku";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const limitArg = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? parseInt(process.argv[i + 1]) : 0;
})();

function sshPsql(sql) {
  // Pipe SQL to psql inside the postgres container on the server.
  return execFileSync(
    "ssh",
    [...SSH, `docker exec -i iku-postgres psql -U iku -d iku -t -A -F '|'`],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

function idFromSlug(slug) {
  const m = /^hn1-(\d+)/.exec(slug);
  return m ? m[1] : null;
}

// 1. Pull hanime1 ids (dead ones first — we're reviving them).
const limitSql = limitArg > 0 ? `LIMIT ${limitArg}` : "";
const rows = sshPsql(
  `SELECT pk, slug FROM videos WHERE source='hanime1' ORDER BY score DESC ${limitSql};`,
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [pk, slug] = l.split("|");
    return { pk, slug, id: idFromSlug(slug) };
  })
  .filter((r) => r.id);

console.log(`hanime1: ${rows.length} rows to refresh`);

let ok = 0,
  gone = 0,
  err = 0;
let batch = [];

async function flush() {
  if (!batch.length) return;
  // One UPDATE per row via a VALUES join.
  const values = batch
    .map((b) => `(${b.pk}, '${b.url.replace(/'/g, "''")}')`)
    .join(",");
  const sql = `UPDATE videos AS v SET url = d.url, dead_at = NULL FROM (VALUES ${values}) AS d(pk, url) WHERE v.pk = d.pk;`;
  sshPsql(sql);
  batch = [];
}

for (let i = 0; i < rows.length; i++) {
  const { pk, id } = rows[i];
  try {
    const html = await fetch(`https://hanime1.com/watch?v=${id}`, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://hanime1.com/",
      },
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.text());
    // Highest-quality mp4: pick the 1080p if present else the first.
    const urls = [
      ...html.matchAll(
        /https:\/\/[a-z0-9.-]*hembed\.com\/[^"'\s]+?\.mp4[^"'\s]*/gi,
      ),
    ].map((m) => m[0].replace(/&amp;/g, "&"));
    const best =
      urls.find((u) => /1080p/.test(u)) ||
      urls.find((u) => /720p/.test(u)) ||
      urls[0];
    if (!best) {
      gone++;
    } else {
      batch.push({ pk, url: best });
      ok++;
      if (batch.length >= 25) await flush();
    }
  } catch {
    err++;
  }
  if (i % 100 === 0) {
    await flush();
    console.log(`${i}/${rows.length} — ok ${ok} gone ${gone} err ${err}`);
  }
  await new Promise((r) => setTimeout(r, 500)); // polite ~2 req/s
}
await flush();
console.log(`DONE hanime1: revived ${ok}, gone ${gone}, err ${err}`);
