#!/usr/bin/env node
/**
 * Probe which field name / format ExoClick accepts for CPM floor updates.
 * Their API silently accepts "Zone updated." but drops minimum_cpm changes.
 */

const KEY = process.env.EXOCLICK_API_KEY;
const ZONE = 5893256;

async function login() {
  const r = await fetch("https://api.exoclick.com/v2/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: KEY }),
  });
  return (await r.json()).token;
}

async function getZone(token, id) {
  const r = await fetch(`https://api.exoclick.com/v2/zones/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  return (await r.json()).result?.zone;
}

async function tryPatch(token, patch, label) {
  const r = await fetch(`https://api.exoclick.com/v2/zones/${ZONE}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch),
  });
  const text = await r.text();
  const after = await getZone(token, ZONE);
  const got = after?.minimum_cpm;
  console.log(
    `${label.padEnd(30)} PUT=${r.status} body=${text.slice(0, 100)}  →  minimum_cpm=${got}`,
  );
}

async function main() {
  const token = await login();
  const before = await getZone(token, ZONE);
  console.log("Full zone GET keys:", Object.keys(before).sort().join(", "));
  console.log("Current minimum_cpm raw:", JSON.stringify(before.minimum_cpm));
  console.log();

  // First dump full zone for inspection
  console.log("--- current values of likely CPM-floor fields ---");
  for (const k of Object.keys(before)) {
    if (
      k.toLowerCase().includes("cpm") ||
      k.toLowerCase().includes("price") ||
      k.toLowerCase().includes("floor")
    ) {
      console.log(`  ${k} = ${JSON.stringify(before[k])}`);
    }
  }
  console.log();

  // Try various payload shapes
  await tryPatch(token, { minimum_cpm: 0.05 }, "minimum_cpm number");
  await tryPatch(token, { minimum_cpm: "0.05" }, "minimum_cpm string");
  await tryPatch(
    token,
    { minimum_cpm: 0.05, pricing_models: [1] },
    "+ pricing_models",
  );
  await tryPatch(token, { min_cpm: 0.05 }, "min_cpm");
  await tryPatch(token, { minCPM: 0.05 }, "minCPM");
  await tryPatch(token, { minimumCpm: 0.05 }, "minimumCpm");
  await tryPatch(token, { price_floor: 0.05 }, "price_floor");
  await tryPatch(token, { floor_cpm: 0.05 }, "floor_cpm");
  await tryPatch(token, { cpm_floor: 0.05 }, "cpm_floor");
  await tryPatch(
    token,
    { inventory: { minimum_cpm: 0.05 } },
    "nested inventory",
  );
  await tryPatch(token, { filters: { minimum_cpm: 0.05 } }, "nested filters");
}

main().catch(console.error);
