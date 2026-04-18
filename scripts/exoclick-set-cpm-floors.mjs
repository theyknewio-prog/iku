#!/usr/bin/env node
/**
 * scripts/exoclick-set-cpm-floors.mjs
 *
 * Applies minimum_cpm floors on each ExoClick zone to stop accepting
 * $0.001 bottom-feeder bids. No-fills cascade to our client-side
 * Adsterra fallback (ad-utils.ts::scheduleNoFillFallback).
 *
 * Phase 1 floors (conservative — weed out junk, keep DEU/JPN/CHN demand):
 *   728x90 banner     $0.05   (was DEU eCPM $0.09 → stays filled)
 *   300x250           $0.05
 *   native 300x250    $0.05
 *   300x50 mobile     $0.03
 *   VAST preroll      $1.00   (video CPMs are much higher)
 *   popunder          $0.15
 *   feed interstitial $0.30
 *
 * Run with --dry to preview.
 */

const KEY = process.env.EXOCLICK_API_KEY;
const DRY = process.argv.includes("--dry");
if (!KEY) {
  console.error("EXOCLICK_API_KEY not set");
  process.exit(1);
}

const FLOORS = [
  { id: 5893256, label: "Watch Underplayer 728x90", floor: 0.05 },
  { id: 5893266, label: "Sidebar 300x250", floor: 0.05 },
  { id: 5893268, label: "VAST Preroll", floor: 1.0 },
  { id: 5893290, label: "Popunder", floor: 0.15 },
  { id: 5893292, label: "Native Grid 300x250", floor: 0.05 },
  { id: 5893294, label: "Feed Interstitial", floor: 0.3 },
  { id: 5895978, label: "Mobile 300x50", floor: 0.03 },
];

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
  console.log("Logged in.\n");

  for (const { id, label, floor } of FLOORS) {
    const before = await getZone(token, id);
    if (!before) {
      console.log(`✗ ${id} — not found`);
      continue;
    }
    const current = parseFloat(before.minimum_cpm || 0);
    console.log(`${id} ${label}`);
    console.log(
      `  current min_cpm: $${current.toFixed(3)} → new: $${floor.toFixed(3)}`,
    );
    if (DRY) {
      console.log(`  [DRY] skipped`);
      continue;
    }
    const { status, body } = await updateZone(token, id, {
      minimum_cpm: floor,
    });
    console.log(`  PUT ${status}: ${JSON.stringify(body).slice(0, 120)}`);
    if (status >= 300) continue;
    const after = await getZone(token, id);
    const got = parseFloat(after?.minimum_cpm || 0);
    console.log(
      `  verify min_cpm: $${got.toFixed(3)} ${got === floor ? "✓" : "✗ MISMATCH"}`,
    );
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
