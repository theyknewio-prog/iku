"use client";

let cached: Promise<string> | null = null;

export function getCfCountry(): Promise<string> {
  if (cached) return cached;
  cached = fetch("/cdn-cgi/trace", { cache: "force-cache" })
    .then((r) => (r.ok ? r.text() : ""))
    .then((text) => {
      const m = text.match(/loc=([A-Z]{2})/);
      return m ? m[1] : "US";
    })
    .catch(() => "US");
  return cached;
}
