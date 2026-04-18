// Patch only the SECOND occurrence of statement_timeout = '3s' (the countVideos one).
// Leaves the getVideos timeout at 3s (it fetches real rows for the user).
import fs from "node:fs";

const file = "/app/.next/server/chunks/ssr/src_lib_116rilg._.js";
const src = fs.readFileSync(file, "utf8");

const needle = "statement_timeout = '3s'";
const parts = src.split(needle);

if (parts.length < 3) {
  console.log(`found ${parts.length - 1} occurrence(s), expected 2`);
  if (src.includes("statement_timeout = '500ms'"))
    console.log("already patched");
  process.exit(0);
}

// parts[0] + needle + parts[1] (getVideos - keep 3s) + needle-replaced (countVideos - 500ms) + parts[2]
const out =
  parts[0] +
  needle +
  parts[1] +
  "statement_timeout = '500ms'" +
  parts.slice(2).join(needle);

fs.writeFileSync(file, out);
console.log("patched — countVideos 500ms, getVideos stays 3s");
