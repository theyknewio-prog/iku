"use client";

/**
 * PopunderAd — ExoClick popunder (zone 5893290).
 *
 * Script-only, no visual element. Fires once per session on first mount.
 * Skips for Pro users.
 */

import { useEffect, useRef } from "react";
import { AD_ZONES } from "@/lib/ad-config";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any[];
  }
}

export function PopunderAd() {
  const firedRef = useRef(false);

  useEffect(() => {
    // Skip for Pro users
    if (document.body.dataset.pro === "1") return;
    // Only fire once per session
    if (firedRef.current) return;
    if (sessionStorage.getItem("iku-popunder-fired")) return;

    firedRef.current = true;
    sessionStorage.setItem("iku-popunder-fired", "1");

    // Create a hidden <ins> for the popunder zone
    const ins = document.createElement("ins");
    ins.className = "eas6a97888e2";
    ins.dataset.zoneid = AD_ZONES.exoclick.popunder;
    ins.style.display = "none";
    document.body.appendChild(ins);

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });

    return () => {
      // Cleanup: remove the hidden ins if component unmounts
      if (ins.parentNode) ins.parentNode.removeChild(ins);
    };
  }, []);

  return null; // no visual element
}
