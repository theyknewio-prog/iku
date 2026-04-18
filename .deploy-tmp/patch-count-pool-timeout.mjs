// Runtime patch for /app/.next/server/chunks/ssr/src_lib_116rilg._.js
// Adds connection-timeout / pool-timeout to the countVideos fallback branch
// so memoize caches the estimate instead of re-throwing (which bypassed
// the cache and caused the thundering herd).

import fs from "node:fs";

const file = "/app/.next/server/chunks/ssr/src_lib_116rilg._.js";
const src = fs.readFileSync(file, "utf8");

const needle = '"57014"===b';
const replacement =
  '("57014"===b||(d&&d.message&&(d.message.indexOf("Connection terminated")>=0||d.message.indexOf("timeout")>=0)))';

if (src.includes(replacement)) {
  console.log("already patched");
  process.exit(0);
}
if (!src.includes(needle)) {
  console.error("needle not found — chunk may have been rebuilt");
  process.exit(1);
}

const out = src.split(needle).join(replacement);
fs.writeFileSync(file, out);
console.log("patched", file);
