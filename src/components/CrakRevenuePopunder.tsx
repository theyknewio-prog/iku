"use client";

/**
 * CrakRevenuePopunder — opens the AI Smartlink in a popunder tab on the
 * first qualifying click. Replaces the deleted HilltopPopunder (which was
 * pushing fake-Chrome-update creatives).
 *
 * CrakRevenue's mnpw3.js handles all the popunder logic: it listens for
 * the first non-form click after page load and opens the configured URL
 * in a new tab with a 24h cookie cap (cookieExpires: 86401s).
 *
 * Excludes /feed, /pricing, /checkout, /login, /signup, Pro users — same
 * exclusion list as the IPP component.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CRAK_CREATIVES } from "@/lib/crakrevenue-creatives";

const SCRIPT_ID = "iku-crak-popunder";
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

export function CrakRevenuePopunder() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    )
      return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;
    if (document.getElementById(SCRIPT_ID)) return;

    // Settle 4s — popunder shouldn't fight LCP. The browser's popup-blocker
    // policy still requires a real user gesture, so the user has to click
    // anyway; delaying the script load doesn't change perceived behavior.
    const t = setTimeout(() => {
      try {
        const loader = document.createElement("script");
        loader.id = SCRIPT_ID;
        loader.src = CRAK_CREATIVES.popunder.scriptSrc;
        loader.async = true;

        // After mnpw3.js loads, register the popunder with the AI Smartlink
        // URL. Use a separate inline script that runs after the loader.
        loader.onload = () => {
          try {
            const init = document.createElement("script");
            init.id = SCRIPT_ID + "-init";
            init.text = CRAK_CREATIVES.popunder.initCall;
            document.body.appendChild(init);
          } catch {
            /* swallow */
          }
        };

        document.body.appendChild(loader);
      } catch (e) {
        console.warn("[crak-popunder] inject failed:", e);
      }
    }, 4000);

    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
