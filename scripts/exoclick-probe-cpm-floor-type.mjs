#!/usr/bin/env node
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
  console.log(
    `${label.padEnd(40)} ${r.status} | body=${text.slice(0, 80)} | type=${after?.cpm_floor_type} min_cpm=${after?.minimum_cpm} is_editable=${after?.is_editable}`,
  );
}

async function main() {
  const token = await login();
  const before = await getZone(token, ZONE);
  console.log("is_editable:", before.is_editable);
  console.log("cpm_floor_type:", before.cpm_floor_type);
  console.log("pricing_models:", JSON.stringify(before.pricing_models));
  console.log();

  await tryPatch(token, { cpm_floor_type: 1 }, "cpm_floor_type=1 alone");
  await tryPatch(token, { cpm_floor_type: 2 }, "cpm_floor_type=2 alone");
  await tryPatch(
    token,
    { cpm_floor_type: 1, minimum_cpm: 0.05 },
    "type=1 + min_cpm=0.05",
  );
  await tryPatch(
    token,
    { cpm_floor_type: 2, minimum_cpm: 0.05 },
    "type=2 + min_cpm=0.05",
  );
  await tryPatch(
    token,
    { cpm_floor_type: 3, minimum_cpm: 0.05 },
    "type=3 + min_cpm=0.05",
  );

  // Maybe need to toggle enable_bid_shading too
  await tryPatch(
    token,
    { enable_bid_shading: 1, cpm_floor_type: 1, minimum_cpm: 0.05 },
    "bid_shading + type + min",
  );

  // Reset to 0 if nothing worked
  await tryPatch(token, { cpm_floor_type: 0, minimum_cpm: 0 }, "RESET");
}

main().catch(console.error);
