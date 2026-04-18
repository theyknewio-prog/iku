#!/usr/bin/env node
/**
 * scripts/exoclick-zone-stats.mjs
 *
 * For each of our ExoClick zones, pulls last-14d stats grouped by country
 * using the correct `?zone=` query string (the intuitive `?zone-id=` is
 * silently ignored by the API — it returns publisher-wide totals).
 */

const KEY = process.env.EXOCLICK_API_KEY;
if (!KEY) {
  console.error("EXOCLICK_API_KEY not set");
  process.exit(1);
}

const ZONES = [
  { id: 5893256, label: "Watch Underplayer 728x90" },
  { id: 5893266, label: "Sidebar 300x250" },
  { id: 5893268, label: "VAST Preroll" },
  { id: 5893290, label: "Popunder" },
  { id: 5893292, label: "Native Grid" },
  { id: 5893294, label: "Feed Interstitial" },
  { id: 5895978, label: "Mobile 300x50" },
];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function range14d() {
  const end = new Date(Date.now() - 86400_000);
  const start = new Date(end.getTime() - 13 * 86400_000);
  return { start: ymd(start), end: ymd(end) };
}

async function login() {
  const r = await fetch("https://api.exoclick.com/v2/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: KEY }),
  });
  const j = await r.json();
  if (!j.token) throw new Error(`Login: ${JSON.stringify(j)}`);
  return j.token;
}

async function getPerCountry(token, zoneId, start, end) {
  const url = `https://api.exoclick.com/v2/statistics/p/country?date-from=${start}&date-to=${end}&zone=${zoneId}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const j = await r.json();
  return j.result || [];
}

async function getZoneConfig(token, id) {
  const r = await fetch(`https://api.exoclick.com/v2/zones/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const j = await r.json();
  return j.result?.zone;
}

function pad(s, n, right = false) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  return right ? s + " ".repeat(n - s.length) : " ".repeat(n - s.length) + s;
}

async function main() {
  const { start, end } = range14d();
  console.log(`Range: ${start} → ${end}\n`);
  const token = await login();

  for (const { id, label } of ZONES) {
    const [cfg, rows] = await Promise.all([
      getZoneConfig(token, id),
      getPerCountry(token, id, start, end),
    ]);
    const totalImp = rows.reduce((a, r) => a + (+r.impressions || 0), 0);
    const totalRev = rows.reduce((a, r) => a + (+r.revenue || 0), 0);
    const ecpm = totalImp > 0 ? (totalRev / totalImp) * 1000 : 0;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Zone ${id} — ${label}  (size=${cfg?.size || "?"})`);
    console.log(
      `  min_cpm=$${cfg?.minimum_cpm || 0}  pricing=${JSON.stringify(cfg?.pricing_models || [])}  active=${cfg?.active}`,
    );
    console.log(
      `  14d: ${totalImp} imp, $${totalRev.toFixed(4)}, eCPM $${ecpm.toFixed(4)}`,
    );
    if (rows.length === 0) {
      console.log(`  (no stats — 0 impressions)`);
      continue;
    }
    rows.sort((a, b) => (+b.impressions || 0) - (+a.impressions || 0));
    console.log(
      `  ${pad("country", 8, true)}${pad("imp", 8)}${pad("rev$", 11)}${pad("eCPM$", 10)}`,
    );
    for (const r of rows.slice(0, 10)) {
      const imp = +r.impressions || 0;
      const rev = +r.revenue || 0;
      const e = imp > 0 ? (rev / imp) * 1000 : 0;
      console.log(
        `  ${pad(r.country || "?", 8, true)}${pad(imp, 8)}${pad("$" + rev.toFixed(5), 11)}${pad("$" + e.toFixed(4), 10)}`,
      );
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
