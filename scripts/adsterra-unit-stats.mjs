#!/usr/bin/env node
/**
 * scripts/adsterra-unit-stats.mjs
 *
 * 14-day Adsterra stats grouped by domain+placement (unit) so we can compare
 * per-unit eCPM against ExoClick zone eCPMs and decide whether to invert
 * the waterfall (Adsterra primary on high-CPM geos, ExoClick secondary).
 */

const KEY = process.env.ADSTERRA_API_KEY;
if (!KEY) {
  console.error("ADSTERRA_API_KEY not set");
  process.exit(1);
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
const end = ymd(new Date(Date.now() - 86400_000));
const start = ymd(new Date(Date.now() - 14 * 86400_000));

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { "X-API-Key": KEY, Accept: "application/json" },
  });
  const text = await r.text();
  try {
    return { status: r.status, json: JSON.parse(text) };
  } catch {
    return { status: r.status, raw: text.slice(0, 400) };
  }
}

async function main() {
  console.log(`Range: ${start} → ${end}\n`);

  // 1) Full 14d breakdown by placement
  console.log("━━ By placement (14d) ━━");
  {
    const { status, json, raw } = await fetchJson(
      `https://api3.adsterratools.com/publisher/stats.json?start_date=${start}&finish_date=${end}&group_by=placement`,
    );
    console.log(`Status: ${status}`);
    if (raw) {
      console.log(raw);
    } else {
      const rows = json.items || [];
      rows.sort((a, b) => (+b.revenue || 0) - (+a.revenue || 0));
      console.log(
        `${"placement".padEnd(12)} ${"imp".padStart(9)} ${"clicks".padStart(7)} ${"rev".padStart(10)} ${"eCPM".padStart(9)}`,
      );
      for (const r of rows) {
        const imp = +r.impression || 0;
        const rev = +r.revenue || 0;
        const ecpm = imp > 0 ? (rev / imp) * 1000 : 0;
        console.log(
          `${String(r.placement).padEnd(12)} ${String(imp).padStart(9)} ${String(r.clicks || 0).padStart(7)} ${("$" + rev.toFixed(3)).padStart(10)} ${("$" + ecpm.toFixed(3)).padStart(9)}`,
        );
      }
    }
  }

  // 2) Per-country (top 20)
  console.log("\n━━ By country (top 20, 14d) ━━");
  {
    const { status, json, raw } = await fetchJson(
      `https://api3.adsterratools.com/publisher/stats.json?start_date=${start}&finish_date=${end}&group_by=country`,
    );
    console.log(`Status: ${status}`);
    if (raw) {
      console.log(raw);
    } else {
      const rows = json.items || [];
      rows.sort((a, b) => (+b.impression || 0) - (+a.impression || 0));
      console.log(
        `${"country".padEnd(8)} ${"imp".padStart(9)} ${"rev".padStart(10)} ${"eCPM".padStart(9)}`,
      );
      for (const r of rows.slice(0, 20)) {
        const imp = +r.impression || 0;
        const rev = +r.revenue || 0;
        const ecpm = imp > 0 ? (rev / imp) * 1000 : 0;
        console.log(
          `${String(r.country).padEnd(8)} ${String(imp).padStart(9)} ${("$" + rev.toFixed(3)).padStart(10)} ${("$" + ecpm.toFixed(3)).padStart(9)}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
