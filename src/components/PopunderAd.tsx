"use client";

/**
 * PopunderAd — ExoClick popunder (zone 5893290).
 *
 * Popunders use a different script tag than banners.
 * Fires once per session. Skips for Pro users.
 */

import { useEffect, useRef } from "react";
import { AD_ZONES } from "@/lib/ad-config";

export function PopunderAd() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (document.body.dataset.pro === "1") return;
    if (firedRef.current) return;
    if (sessionStorage.getItem("iku-popunder-fired")) return;

    firedRef.current = true;
    sessionStorage.setItem("iku-popunder-fired", "1");

    // ExoClick popunders load via a separate script URL pattern
    const script = document.createElement("script");
    script.src = `https://a.magsrv.com/ad-provider.js`;
    script.async = true;
    document.body.appendChild(script);

    const ins = document.createElement("ins");
    ins.className = "eas6a97888e2";
    ins.dataset.zoneid = AD_ZONES.exoclick.popunder;
    ins.style.display = "none";
    document.body.appendChild(ins);

    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).AdProvider = (window as any).AdProvider || []).push({ serve: {} });
    };

    return () => {
      if (ins.parentNode) ins.parentNode.removeChild(ins);
    };
  }, []);

  return null;
}
