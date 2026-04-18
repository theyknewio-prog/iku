#!/usr/bin/env node
const fs = require("fs");
const f = process.argv[2];
if (!f) {
  console.error("Usage: node patch-wp-add-hentaigasm.js <file>");
  process.exit(2);
}
let c = fs.readFileSync(f, "utf8");
const OLD = "source IN ('wp', 'hentaicity') AND source_id = $1";
const NEW = "source IN ('wp', 'hentaicity', 'hentaigasm') AND source_id = $1";
if (!c.includes(OLD)) {
  console.error("OLD not found");
  process.exit(1);
}
if (c.includes(NEW)) {
  console.error("Already patched");
  process.exit(0);
}
c = c.replace(OLD, NEW);
fs.writeFileSync(f, c);
console.log("patched");
