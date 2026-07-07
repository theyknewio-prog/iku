"use client";

/**
 * AdsterraSocialBar — SocialBar_1 (placement 28986140), tag verbatim from
 * the Adsterra dashboard (Get Code, 2026-07-07). Replaces MondiadInPagePush
 * in layout.tsx — same visual slot (floating overlay), so net visible ads
 * stay flat. Historical CTR 8.77% (45 clicks / 513 imps, best display CTR
 * ever measured on this site) vs Mondiad push $0.005 all-time.
 *
 * Script domain pl*.effectivecpmnetwork.com is covered by the CSP wildcard
 * shipped in e0db790. Loads after window.load to keep LCP clean.
 */

import { useEffect } from "react";

const SOCIAL_BAR_SRC =
  "https://pl29086639.effectivecpmnetwork.com/c8/e2/6d/c8e26d62c412ef890a2ce3e83d94da53.js";

export function AdsterraSocialBar() {
  useEffect(() => {
    if (document.body?.dataset.pro === "1") return;
    if (window.location.pathname.startsWith("/feed")) return;
    if (document.querySelector('script[data-adsterra-sb="1"]')) return;

    const inject = () => {
      const s = document.createElement("script");
      s.src = SOCIAL_BAR_SRC;
      s.async = true;
      s.dataset.adsterraSb = "1";
      document.body.appendChild(s);
    };

    if (document.readyState === "complete") {
      const t = setTimeout(inject, 1000);
      return () => clearTimeout(t);
    }
    const onLoad = () => setTimeout(inject, 1000);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
