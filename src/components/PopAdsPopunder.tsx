"use client";

/**
 * PopAdsPopunder — PopAds.net popunder for iku.gg.
 *
 * Site ID 5296964 (status: Approved 2026-05-01).
 *
 * Standard adcode chosen over anti-adblock to keep CSP minimal: it loads
 * only from blockadsnot.com + cloudfront.net (both already whitelisted in
 * middleware.ts for HilltopAds). Anti-adblock variant rotates through
 * additional domains (zlchyjwgxysknk.com, wnidpjdd.com) which PopAds
 * cycles every few weeks — would force a CSP edit each rotation.
 *
 * Trade-off: adblock users (~50% of porn audience) won't see the popunder.
 * If revenue J+7 is meh, swap to anti-adblock variant + add those hosts
 * to AD_SCRIPT in middleware.ts.
 *
 * Mounted in layout.tsx body, fires once per session (popundersPerIP=0
 * = unlimited per default config but PopAds caps via siteId tuning).
 *
 * The script is the verbatim Standard Adcode from popads.net/websites/code
 * for site 5296964 — DO NOT modify the obfuscated math (siteId is encoded
 * inside `140-472*485*973+228035984` for anti-scraper protection).
 */

import { useEffect } from "react";

export function PopAdsPopunder() {
  useEffect(() => {
    // Only fire once per page lifecycle. The PopAds script self-guards
    // via `window['a6865e44...']` but we double-check to avoid double-init
    // on React StrictMode dev mounts.
    const KEY = "a6865e44a352fc92c7dde9d5a29a8e56";
    if ((window as unknown as Record<string, unknown>)[KEY]) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.setAttribute("data-cfasync", "false");
    script.text =
      '(function(){var c=window,s="a6865e44a352fc92c7dde9d5a29a8e56",g=[["siteId",140-472*485*973+228035984],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],y=["d3d3LmJsb2NrYWRzbm90LmNvbS9vL1FTaGlmWS9mYnJlZXplLm1pbi5qcw==","ZG5oZmk1bm4yZHQ2Ny5jbG91ZGZyb250Lm5ldC9idHJhbnNkdWNlcnMubWluLmpz"],a=-1,l,v,f=function(){clearTimeout(v);a++;if(y[a]&&!(1804188477000<(new Date).getTime()&&1<a)){l=c.document.createElement("script");l.type="text/javascript";l.async=!0;var d=c.document.getElementsByTagName("script")[0];l.src="https://"+atob(y[a]);l.crossOrigin="anonymous";l.onerror=f;l.onload=function(){clearTimeout(v);c[s.slice(0,16)+s.slice(0,16)]||f()};v=setTimeout(f,5E3);d.parentNode.insertBefore(l,d)}};if(!c[s]){try{Object.freeze(c[s]=g)}catch(e){}f()}})();';
    document.head.appendChild(script);
  }, []);

  return null;
}
