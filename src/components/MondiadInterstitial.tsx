"use client";

import { useEffect } from "react";

const INTERSTITIAL_SRC = "https://ss.mrmnd.com/interstitial.js";
const INTERSTITIAL_ID = "11b9aac6-98c2-4534-a3c7-1994d123ef36";

export function MondiadInterstitial() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.body?.dataset.pro === "1") return;
    if (document.querySelector('script[data-mondiad-int="1"]')) return;
    // Owner rule: max 1 interstitial/popunder per session. Without this the
    // script re-armed on every full page load since 2026-05-11.
    if (window.location.pathname.startsWith("/feed")) return; // Shorts ad-free
    try {
      if (sessionStorage.getItem("iku-int-fired") === "1") return;
    } catch {
      /* sessionStorage blocked (private mode) — fall through, worst case = old behavior */
    }

    const fire = () => {
      try {
        sessionStorage.setItem("iku-int-fired", "1");
      } catch {}
      const s = document.createElement("script");
      s.src = INTERSTITIAL_SRC;
      s.async = true;
      s.dataset.mondiadInt = "1";
      s.setAttribute("data-mndintid", INTERSTITIAL_ID);
      document.body.appendChild(s);
    };

    if (document.readyState === "complete") {
      const t = setTimeout(fire, 1500);
      return () => clearTimeout(t);
    }
    const onLoad = () => {
      setTimeout(fire, 1500);
    };
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
