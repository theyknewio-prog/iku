#!/usr/bin/env node
const k = process.env.POSTHOG_PERSONAL_API_KEY;
async function hq(q) {
  const r = await fetch("https://us.posthog.com/api/projects/370092/query/", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + k,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: q } }),
  });
  return (await r.json()).results;
}

const countries = await hq(
  `SELECT properties.$geoip_country_name, count(DISTINCT person_id) FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
);
const pages = await hq(
  `SELECT properties.$pathname, count() FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
);
const refs = await hq(
  `SELECT properties.$referring_domain, count() FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
);
const hourly = await hq(
  `SELECT toHour(timestamp) h, count(DISTINCT person_id), count() FROM events WHERE event='$pageview' AND toDate(timestamp)=today() GROUP BY 1 ORDER BY 1`,
);

console.log("=== Countries ===");
countries.forEach(([c, n]) => console.log(`  ${c || "?"} — ${n}`));
console.log("\n=== Top pages ===");
pages.forEach(([p, n]) => console.log(`  ${p || "?"} — ${n}`));
console.log("\n=== Referrers ===");
refs.forEach(([r, n]) => console.log(`  ${r || "(direct)"} — ${n}`));
console.log("\n=== Hourly ===");
hourly.forEach(([h, u, p]) =>
  console.log(`  ${String(h).padStart(2, "0")}h — ${u} uniques, ${p} PV`),
);
