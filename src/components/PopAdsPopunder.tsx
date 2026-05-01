"use client";

/**
 * PopAdsPopunder — PopAds.net popunder, site ID 5296964 (iku.gg approved
 * 2026-05-02). Replaces the rejected Clickadu slot.
 *
 * The PopAds script is a self-contained IIFE that loads its loader CDN
 * (blockadsnot.com / cloudfront), then opens the popunder URL on first
 * qualifying click. Frequency controlled by `popundersPerIP: 0` (= unlimited
 * — PopAds throttles server-side).
 *
 * Mounts alongside the CrakRevenue popunder. Two popunders sharing the same
 * click is fine: PopAds CTR cookie is per-domain, CrakRevenue's mnpw3 cookie
 * is per-domain, they don't conflict. Modern browsers allow both because
 * each is triggered by a real user gesture.
 *
 * Excludes Pro + /feed /pricing /checkout /login /signup as usual.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SCRIPT_ID = "iku-popads";
const EXCLUDED_PATHS = [
  "/feed",
  "/pricing",
  "/checkout",
  "/login",
  "/signup",
  "/preview",
  "/forgot-password",
  "/reset-password",
];

export function PopAdsPopunder() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    )
      return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;
    if (document.getElementById(SCRIPT_ID)) return;

    // Settle 5s — popunder needs a click anyway, no rush. Avoid LCP impact.
    const t = setTimeout(() => {
      try {
        const s = document.createElement("script");
        s.id = SCRIPT_ID;
        s.type = "text/javascript";
        s.setAttribute("data-cfasync", "false");
        s.text =
          '/*<![CDATA[/* */(function(){var n=window,y="a6865e44a352fc92c7dde9d5a29a8e56",b=[["siteId",95-640-68*584+376+5336845],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],m=["d3d3LmJsb2NrYWRzbm90LmNvbS9zcGVnYXN1cy5taW4uY3Nz","ZG5oZmk1bm4yZHQ2Ny5jbG91ZGZyb250Lm5ldC9EVWtNL2tuYW5vYmFyLm1pbi5qcw=="],v=-1,a,r,z=function(){clearTimeout(r);v++;if(m[v]&&!(1803596480000<(new Date).getTime()&&1<v)){a=n.document.createElement("script");a.type="text/javascript";a.async=!0;var k=n.document.getElementsByTagName("script")[0];a.src="https://"+atob(m[v]);a.crossOrigin="anonymous";a.onerror=z;a.onload=function(){clearTimeout(r);n[y.slice(0,16)+y.slice(0,16)]||z()};r=setTimeout(z,5E3);k.parentNode.insertBefore(a,k)}};if(!n[y]){try{Object.freeze(n[y]=b)}catch(e){}z()}})();/*]]>/* */';
        document.body.appendChild(s);
      } catch (e) {
        console.warn("[popads] inject failed:", e);
      }
    }, 5000);

    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
