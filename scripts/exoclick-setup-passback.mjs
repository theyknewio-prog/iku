#!/usr/bin/env node
/**
 * scripts/exoclick-setup-passback.mjs
 *
 * Writes an Adsterra passback (alternate_html) into each ExoClick banner zone.
 * When ExoClick no-fills, the browser injects the alternate_html into the
 * <ins> container → Adsterra iframe renders a fallback ad.
 *
 * Zones covered:
 *   5893256  watch-underplayer 728x90  → Adsterra banner728x90
 *   5893266  sidebar 300x250           → Adsterra banner300x250
 *   5895978  mobile 300x50             → Adsterra banner320x50 (closest)
 *
 * Each zone's alternate_html contains a self-contained srcdoc iframe so
 * Adsterra's global atOptions can't clash between zones.
 *
 * Run with --dry to preview the payload. Run without flags to apply.
 */

const EXOCLICK_API_KEY = process.env.EXOCLICK_API_KEY;
const DRY = process.argv.includes("--dry");

if (!EXOCLICK_API_KEY) {
  console.error("EXOCLICK_API_KEY not set in env");
  process.exit(1);
}

// Adsterra invoke.js URLs → extract the hashed key per zone
const ADSTERRA = {
  banner728x90: {
    key: "5a7f6bdcb73dec1719a9657cd49a2bd0",
    url: "https://www.highperformanceformat.com/5a7f6bdcb73dec1719a9657cd49a2bd0/invoke.js",
    w: 728,
    h: 90,
  },
  banner300x250: {
    key: "b149e9de3cee857db29388ee9ca47054",
    url: "https://www.highperformanceformat.com/b149e9de3cee857db29388ee9ca47054/invoke.js",
    w: 300,
    h: 250,
  },
  banner320x50: {
    key: "f11ddd24aa56b6d650655b4563d67461",
    url: "https://www.highperformanceformat.com/f11ddd24aa56b6d650655b4563d67461/invoke.js",
    w: 320,
    h: 50,
  },
};

// Map each ExoClick zone → which Adsterra format to use as fallback
const ZONE_MAP = [
  {
    zoneId: 5893256,
    label: "Watch Underplayer 728x90",
    fallback: "banner728x90",
  },
  { zoneId: 5893266, label: "Sidebar 300x250", fallback: "banner300x250" },
  { zoneId: 5895978, label: "Mobile 300x50", fallback: "banner320x50" },
];

function buildAlternateHtml(fmt) {
  const cfg = ADSTERRA[fmt];
  // srcDoc iframe — isolated atOptions, no cross-zone clash.
  // Single quotes inside attrs → srcdoc wrapped in double-quotes.
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions = {'key':'${cfg.key}','format':'iframe','height':${cfg.h},'width':${cfg.w},'params':{}};</script><script src="${cfg.url}"></script></body></html>`;
  return `<iframe width="${cfg.w}" height="${cfg.h}" frameborder="0" scrolling="no" style="border:none;display:block;margin:0 auto" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcdoc="${srcdoc.replace(/"/g, "&quot;")}"></iframe>`;
}

async function login() {
  const r = await fetch("https://api.exoclick.com/v2/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: EXOCLICK_API_KEY }),
  });
  const j = await r.json();
  if (!j.token) throw new Error(`Login failed: ${JSON.stringify(j)}`);
  return j.token;
}

async function getZone(token, id) {
  const r = await fetch(`https://api.exoclick.com/v2/zones/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const j = await r.json();
  return j.result?.zone;
}

async function updateZone(token, id, patch) {
  const r = await fetch(`https://api.exoclick.com/v2/zones/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch),
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    j = { raw: text.slice(0, 300) };
  }
  return { status: r.status, body: j };
}

async function main() {
  const token = await login();
  console.log("✓ Logged in\n");

  for (const { zoneId, label, fallback } of ZONE_MAP) {
    const before = await getZone(token, zoneId);
    if (!before) {
      console.log(`✗ ${zoneId} — not found`);
      continue;
    }
    const html = buildAlternateHtml(fallback);
    console.log(`\n${zoneId}  ${label}  (${before.size})`);
    console.log(
      `  current alternate_html length: ${(before.alternate_html || "").length}`,
    );
    console.log(`  new alternate_html length:     ${html.length}`);
    console.log(`  fallback_ads flag:             ${before.fallback_ads}`);

    if (DRY) {
      console.log(`  [DRY] would set → Adsterra ${fallback}`);
      continue;
    }

    const { status, body } = await updateZone(token, zoneId, {
      alternate_html: html,
      fallback_ads: 1,
    });
    console.log(`  PUT status: ${status}`);
    if (status >= 300) {
      console.log(`  ✗ error:`, JSON.stringify(body).slice(0, 400));
    } else {
      console.log(`  ✓ applied`);
    }

    // Verify
    const after = await getZone(token, zoneId);
    console.log(
      `  verify alternate_html length: ${(after?.alternate_html || "").length}`,
    );
    console.log(`  verify fallback_ads:          ${after?.fallback_ads}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
