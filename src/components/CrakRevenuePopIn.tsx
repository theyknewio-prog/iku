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
import { CRAK_CREATIVES } from "@/lib/crakrevenue-creatives";

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

    const t = setTimeout(() => {
      try {
        // The affstitial script reads its config from a global named
        // `crakPopInParamsOverlay`. Set it BEFORE injecting the loader.
        const cfg = document.createElement("script");
        cfg.id = SCRIPT_ID + "-cfg";
        cfg.text = `var ${CRAK_CREATIVES.popInOverlay.initVar} = ${JSON.stringify(CRAK_CREATIVES.popInOverlay.config)};`;
        document.head.appendChild(cfg);

        const loader = document.createElement("script");
        loader.id = SCRIPT_ID;
        loader.src = CRAK_CREATIVES.popInOverlay.scriptSrc;
        loader.async = true;
        document.body.appendChild(loader);
      } catch (e) {
        console.warn("[crak-popin] inject failed:", e);
      }
    }, 5000);

    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
