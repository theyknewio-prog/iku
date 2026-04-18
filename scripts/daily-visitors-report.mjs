#!/usr/bin/env node
// Daily visitors report → Telegram (Sab).
// Runs at 23:59 Paris time via cron on Hetzner.

const POSTHOG_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT = "370092";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "5617056258";

if (!POSTHOG_KEY || !TG_TOKEN) {
  console.error("Missing POSTHOG_PERSONAL_API_KEY or TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

async function hq(query) {
  const r = await fetch(
    `https://us.posthog.com/api/projects/${POSTHOG_PROJECT}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    },
  );
  const j = await r.json();
  if (!j.results) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.results;
}

const today = await hq(
  `SELECT count(DISTINCT person_id), count() FROM events WHERE event='$pageview' AND toDate(timestamp) = today()`,
);
const yest = await hq(
  `SELECT count(DISTINCT person_id), count() FROM events WHERE event='$pageview' AND toDate(timestamp) = today() - 1`,
);
const d7 = await hq(
  `SELECT count(DISTINCT person_id), count() FROM events WHERE event='$pageview' AND timestamp >= now() - INTERVAL 7 DAY`,
);
const countries = await hq(
  `SELECT properties.$geoip_country_name, count(DISTINCT person_id) FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
);
const pages = await hq(
  `SELECT properties.$pathname, count() FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
);
const refs = await hq(
  `SELECT properties.$referring_domain, count() FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
);

const [u, p] = today[0];
const [uy, py] = yest[0];
const [u7, p7] = d7[0];
const delta = uy ? Math.round(((u - uy) / uy) * 100) : 0;
const arrow = delta >= 0 ? "📈" : "📉";

const fmt = (rows) => rows.map((r) => `• ${r[0] || "?"} — ${r[1]}`).join("\n");

const msg = `📊 iku.gg — Visiteurs du jour
━━━━━━━━━━━━━━━━━
👤 ${u} uniques (${p} pageviews)
${arrow} ${delta > 0 ? "+" : ""}${delta}% vs hier (${uy})
📅 7j : ${u7} uniques / ${p7} PV

🌍 Top pays:
${fmt(countries)}

📄 Top pages:
${fmt(pages)}

🔗 Top referrers:
${fmt(refs)}`;

const tg = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
});
const tgj = await tg.json();
if (!tgj.ok) {
  console.error(tgj);
  process.exit(1);
}
console.log("Sent:", u, "uniques");
