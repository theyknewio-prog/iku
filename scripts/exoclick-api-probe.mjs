#!/usr/bin/env node
/**
 * Probe ExoClick publisher stats API to find the correct per-zone endpoint.
 * The /p/country?zone-id=... one we tried returns aggregate totals — the
 * zone-id query string is ignored.
 */

const KEY = process.env.EXOCLICK_API_KEY;

async function login() {
  const r = await fetch("https://api.exoclick.com/v2/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_token: KEY }),
  });
  const j = await r.json();
  return j.token;
}

async function tryEndpoint(token, url, label) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    j = { raw: text.slice(0, 200) };
  }
  console.log(`\n━━ ${label}`);
  console.log(`URL: ${url}`);
  console.log(`Status: ${r.status}`);
  const rows = j.result || j.resultSet || j.data;
  if (Array.isArray(rows)) {
    console.log(`Rows: ${rows.length}`);
    console.log(`First 3:`, JSON.stringify(rows.slice(0, 3), null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(j).slice(0, 500));
  }
}

const end = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
const start = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);

async function main() {
  const token = await login();
  const qs = `date-from=${start}&date-to=${end}`;

  // 1) Publisher: break by zone (list zones with 14d stats)
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/zone?${qs}`,
    "p/zone",
  );

  // 2) Publisher: per-country breakdown with zone filter (different param name)
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/country?${qs}&zoneid=5893256`,
    "p/country?zoneid=5893256",
  );
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/country?${qs}&zone=5893256`,
    "p/country?zone=5893256",
  );
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/country?${qs}&filter[zone]=5893256`,
    "p/country?filter[zone]=...",
  );
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/country?${qs}&zoneids=5893256`,
    "p/country?zoneids=...",
  );

  // 3) Possibly a nested path
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/zone/5893256/country?${qs}`,
    "p/zone/{id}/country",
  );
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/zones/5893256/country?${qs}`,
    "p/zones/{id}/country",
  );

  // 4) Two-dimensional pivot
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/zone?${qs}&include=country`,
    "p/zone?include=country",
  );
  await tryEndpoint(
    token,
    `https://api.exoclick.com/v2/statistics/p/zone-country?${qs}`,
    "p/zone-country",
  );
}

main().catch(console.error);
