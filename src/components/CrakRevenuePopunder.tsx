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
import { getCrakCreatives } from "@/lib/crakrevenue-creatives";
import { getCfCountry } from "@/lib/cf-country";

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

    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      try {
        const country = await getCfCountry();
        if (cancelled) return;
        const creatives = getCrakCreatives(country);

        const loader = document.createElement("script");
        loader.id = SCRIPT_ID;
        loader.src = creatives.popunder.scriptSrc;
        loader.async = true;

        loader.onload = () => {
          try {
            const init = document.createElement("script");
            init.id = SCRIPT_ID + "-init";
            init.text = creatives.popunder.initCall;
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

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
