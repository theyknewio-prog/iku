#!/usr/bin/env node
/**
 * scripts/revenue-trend-14d.mjs
 *
 * One-shot 14-day revenue trend for iku.gg.
 * Pulls ExoClick + Adsterra per-day revenue, formats a Telegram table, sends it.
 *
 * Requires (on Hetzner /opt/iku-scrapers/.env):
 *   EXOCLICK_API_KEY, ADSTERRA_API_KEY, TELEGRAM_BOT_TOKEN
 */

const EXOCLICK_API_KEY = process.env.EXOCLICK_API_KEY;
const ADSTERRA_API_KEY = process.env.ADSTERRA_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = "5617056258";
const DRY = process.argv.includes("--dry-run");

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function rangeLast14d() {
  const end = new Date(Date.now() - 86400_000); // yesterday (full day)
  const start = new Date(end.getTime() - 13 * 86400_000); // 14 days inclusive
  return { start: ymd(start), end: ymd(end) };
}

async function exoclickLogin() {
  const res = await fetch("https://api.exoclick.com/v2/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: EXOCLICK_API_KEY }),
  });
  const j = await res.json();
  if (!j.token) throw new Error(`ExoClick login: ${JSON.stringify(j)}`);
  return j.token;
}

async function fetchExoclick(start, end) {
  const token = await exoclickLogin();
  const r = await fetch(
    `https://api.exoclick.com/v2/statistics/p/date?date-from=${start}&date-to=${end}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
  );
  const j = await r.json();
  const map = new Map();
  for (const row of j.result || []) {
    map.set(row.ddate, {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    });
  }
  return map;
}

async function fetchAdsterra(start, end) {
  const r = await fetch(
    `https://api3.adsterratools.com/publisher/stats.json?start_date=${start}&finish_date=${end}&group_by=date`,
    { headers: { "X-API-Key": ADSTERRA_API_KEY, Accept: "application/json" } },
  );
  const j = await r.json();
  const map = new Map();
  for (const row of j.items || []) {
    map.set(row.date, {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impression) || 0,
      clicks: Number(row.clicks) || 0,
    });
  }
  return map;
}

function pad(s, n, right = false) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  return right ? s + " ".repeat(n - s.length) : " ".repeat(n - s.length) + s;
}

function eur(n) {
  return "$" + n.toFixed(3);
}

function numK(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

async function main() {
  const { start, end } = rangeLast14d();
  console.log(`Range: ${start} → ${end}`);

  const [exo, ads] = await Promise.all([
    fetchExoclick(start, end),
    fetchAdsterra(start, end),
  ]);

  // Build dense day list
  const days = [];
  const startDate = new Date(start + "T00:00:00Z");
  for (let i = 0; i < 14; i++) {
    days.push(ymd(new Date(startDate.getTime() + i * 86400_000)));
  }

  let exoTotal = 0;
  let adsTotal = 0;
  let exoImp = 0;
  let adsImp = 0;

  const rows = days.map((d) => {
    const e = exo.get(d) || { revenue: 0, impressions: 0 };
    const a = ads.get(d) || { revenue: 0, impressions: 0 };
    exoTotal += e.revenue;
    adsTotal += a.revenue;
    exoImp += e.impressions;
    adsImp += a.impressions;
    return {
      d,
      exoRev: e.revenue,
      exoImp: e.impressions,
      adsRev: a.revenue,
      adsImp: a.impressions,
      total: e.revenue + a.revenue,
    };
  });

  const total = exoTotal + adsTotal;
  const avgDaily = total / 14;

  // Build table
  const header =
    pad("date", 10, true) +
    pad("exo$", 8) +
    pad("exoI", 7) +
    pad("ads$", 8) +
    pad("adsI", 7) +
    pad("tot$", 8);
  const sep = "─".repeat(header.length);
  const body = rows
    .map(
      (r) =>
        pad(r.d.slice(5), 10, true) +
        pad(eur(r.exoRev), 8) +
        pad(numK(r.exoImp), 7) +
        pad(eur(r.adsRev), 8) +
        pad(numK(r.adsImp), 7) +
        pad(eur(r.total), 8),
    )
    .join("\n");
  const totalRow =
    pad("TOTAL", 10, true) +
    pad(eur(exoTotal), 8) +
    pad(numK(exoImp), 7) +
    pad(eur(adsTotal), 8) +
    pad(numK(adsImp), 7) +
    pad(eur(total), 8);

  const html = `📊 <b>iku.gg Revenue — 14-day trend</b>
Range: <code>${start}</code> → <code>${end}</code>

<pre>${header}
${sep}
${body}
${sep}
${totalRow}</pre>

<b>Totals</b>
• ExoClick: <b>${eur(exoTotal)}</b> (${numK(exoImp)} imp)
• Adsterra: <b>${eur(adsTotal)}</b> (${numK(adsImp)} imp)
• <b>Combined: ${eur(total)}</b>
• Avg/day: ${eur(avgDaily)}
• Implied RPM (ads combined): ${exoImp + adsImp > 0 ? "$" + ((total / (exoImp + adsImp)) * 1000).toFixed(2) : "n/a"}

⚠️ Ça reste minuscule — à scaler avec tâches #11 (nouveaux partenaires) + #12 (max-out CPM).`;

  console.log(html.replace(/<[^>]+>/g, ""));

  if (DRY) return;
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not set");
    process.exit(1);
  }
  const tg = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );
  const tgj = await tg.json();
  console.log("Telegram:", tgj.ok ? "OK msg " + tgj.result.message_id : tgj);
  if (!tgj.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
