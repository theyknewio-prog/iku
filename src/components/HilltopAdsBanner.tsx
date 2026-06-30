"use client";

/**
 * HilltopAdsBanner — homepage Placement B.
 *
 * Restored 2026-05-02 after ad nuke. Renders a HilltopAds banner zone
 * inside a srcdoc iframe so the IIFE's `document.scripts[length-1]`
 * insertion anchor resolves cleanly (each iframe owns its document).
 *
 * Per `feedback_respect_ad_format.md`: the iframe is sized exactly to
 * the IAB format (300x250), no border, no padding, no chrome around it.
 * The network's tag executes verbatim.
 *
 * Zone 6969681 = banner 300x250.
 */

const ZONE_SCRIPT_300x250 =
  "https://selfassured-celebration.com/b.XTVysFduGPl-0jYXWPcK/-enm/9xumZCUOlBkPPxTeY/5SN/jDkE2MOKDzEZteNgjqkg2UOGTMYt4GNbQa";

function buildSrcDoc() {
  const injection = `(function(ht){var d=document,s=d.createElement('script'),l=d.scripts[d.scripts.length-1];s.settings=ht||{};s.src=${JSON.stringify(ZONE_SCRIPT_300x250)};s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})`;
  // html+body both transparent: a no-fill load must never show the browser's
  // default white UA canvas (the "pub blanche" issue, fixed 2026-06-30).
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;width:300px;height:250px;}</style></head><body><script>${injection}</script></body></html>`;
}

export function HilltopAdsBanner() {
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;

  return (
    <iframe
      title="hilltop-banner-300x250"
      srcDoc={buildSrcDoc()}
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
