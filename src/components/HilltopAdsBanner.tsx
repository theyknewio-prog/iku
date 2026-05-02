"use client";

/**
 * HilltopAdsBanner — 300x250 banner via srcdoc iframe.
 *
 * Each iframe owns its document so the IIFE's `document.scripts[length-1]`
 * insertion anchor resolves cleanly. Without this isolation, multiple
 * HilltopAds zones on the same page race over the global document.
 *
 * Per `feedback_respect_ad_format.md`: native 300x250, no border, no
 * padding, no chrome. The network's tag executes verbatim.
 */

import { HILLTOPADS_ZONES } from "@/lib/ad-registry";

function buildSrcDoc(scriptSrc: string) {
  const injection = `(function(ht){var d=document,s=d.createElement('script'),l=d.scripts[d.scripts.length-1];s.settings=ht||{};s.src=${JSON.stringify(scriptSrc)};s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;width:300px;height:250px;}</style></head><body><script>${injection}</script></body></html>`;
}

export function HilltopAdsBanner() {
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;

  return (
    <iframe
      title="hilltop-banner-300x250"
      srcDoc={buildSrcDoc(HILLTOPADS_ZONES.banner300x250)}
      width={300}
      height={250}
      scrolling="no"
      frameBorder={0}
      style={{
        display: "block",
        border: "none",
        margin: "0 auto",
        width: 300,
        height: 250,
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
