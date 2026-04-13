#!/usr/bin/env node
/**
 * Patch getVideos ILIKE fallback in compiled content.ts chunks.
 * Replaces the tag-search WHERE clause from:
 *   ($X = ANY(tags) OR $X = ANY(characters) OR $X = ANY(copyrights)
 *    OR (title IS NOT NULL AND title ILIKE '%' || $X || '%'))
 * to use GIN-indexable array overlap operators (&&), dropping the ILIKE
 * that cannot use any index and forces a seq scan of 350K+ rows.
 *
 * Usage: node patch-content-ilike.js <file>
 */
const fs = require("fs");
const path = process.argv[2];
if (!path) { console.error("Usage: node patch-content-ilike.js <file>"); process.exit(2); }
let c = fs.readFileSync(path, "utf8");
const before = c.length;

// Find the ILIKE-using WHERE clause. The minified variable for the
// param index could be f/q/any single letter, so we match with a regex
// and capture the variable name, then substitute it into the replacement.
const DOLLAR = String.fromCharCode(36);
const D2 = DOLLAR + DOLLAR;  // literal "$$" in the output string
const OLD_RE = new RegExp(
  "\\(" + D2.replace(/\$/g, "\\$") + "\\{(\\w+)\\} = ANY\\(tags\\) OR " +
    D2.replace(/\$/g, "\\$") + "\\{\\1\\} = ANY\\(characters\\) OR " +
    D2.replace(/\$/g, "\\$") + "\\{\\1\\} = ANY\\(copyrights\\) OR " +
    "\\(title IS NOT NULL AND title ILIKE '%' \\|\\| " +
    D2.replace(/\$/g, "\\$") + "\\{\\1\\} \\|\\| '%'\\)\\)",
  "g"
);

const m = c.match(OLD_RE);
if (!m) {
  console.error("OLD pattern NOT FOUND in " + path);
  process.exit(1);
}
c = c.replace(OLD_RE, (match, varName) => {
  const D = DOLLAR + DOLLAR + "{" + varName + "}";
  return (
    "(tags && ARRAY[" + D + "]::text[] OR " +
    "COALESCE(characters,ARRAY[]::text[]) && ARRAY[" + D + "]::text[] OR " +
    "COALESCE(copyrights,ARRAY[]::text[]) && ARRAY[" + D + "]::text[])"
  );
});
fs.writeFileSync(path, c);
console.log("patched: " + path + " (" + before + " → " + c.length + ")");
