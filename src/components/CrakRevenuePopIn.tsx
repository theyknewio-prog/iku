"use client";

/**
 * CrakRevenuePopIn — click-triggered overlay (CrakRevenue affstitial).
 * Loads the affstitial script which displays an AI Smartlink offer as a
 * full-page overlay on first qualifying click. ~14 min cookie (expireDays
 * 0.01) — much less aggressive than the popunder's 24h cap.
 *
 * Same exclusion list as Popunder + IPP.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCrakCreatives } from "@/lib/crakrevenue-creatives";
import { getCfCountry } from "@/lib/cf-country";

const SCRIPT_ID = "iku-crak-popin";
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

export function CrakRevenuePopIn() {
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

        const cfg = document.createElement("script");
        cfg.id = SCRIPT_ID + "-cfg";
        cfg.text = `var ${creatives.popInOverlay.initVar} = ${JSON.stringify(creatives.popInOverlay.config)};`;
        document.head.appendChild(cfg);

        const loader = document.createElement("script");
        loader.id = SCRIPT_ID;
        loader.src = creatives.popInOverlay.scriptSrc;
        loader.async = true;
        document.body.appendChild(loader);
      } catch (e) {
        console.warn("[crak-popin] inject failed:", e);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
