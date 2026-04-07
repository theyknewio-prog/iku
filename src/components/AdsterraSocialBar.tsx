"use client";

/**
 * AdsterraSocialBar — Adsterra Social Bar (zone 28986140).
 *
 * Adsterra's Social Bar is their highest CPM mobile format. It renders as
 * a sticky icon cluster at the bottom of the screen (like social share buttons)
 * that expands when tapped. It's 100% mobile-first and non-intrusive compared
 * to banners.
 *
 * This is an Adsterra-exclusive format — ExoClick doesn't have an equivalent.
 *
 * Implementation:
 * Adsterra Social Bar works differently from ExoClick zones. It loads via a
 * self-contained script tag with atOptions config. We inject it once via
 * a <script> element appended to document.body.
 *
 * Pro users see nothing. Script loads lazily after hydration.
 */

import { useEffect } from "react";

const ZONE_ID = "28986140";
const SCRIPT_URL = `//www.topcreativeformat.com/${ZONE_ID}/invoke.js`;

export function AdsterraSocialBar() {
  useEffect(() => {
    // Skip for Pro users
    if (document.body.dataset.pro === "1") return;

    // Skip if already injected (React StrictMode double-invoke guard)
    if (document.getElementById("adsterra-social-bar")) return;

    // Adsterra Social Bar requires an atOptions config object before its script.
    // We inject a <script> tag with the config, then the invoke.js script.
    const configScript = document.createElement("script");
    configScript.id = "adsterra-social-bar";
    configScript.type = "text/javascript";
    configScript.text = [
      "var atOptions = {",
      `  'key': '${ZONE_ID}',`,
      "  'format': 'iframe',",
      "  'height': 0,",
      "  'width': 0,",
      "  'params': {}",
      "};",
    ].join("\n");
    document.body.appendChild(configScript);

    const invokeScript = document.createElement("script");
    invokeScript.id = "adsterra-social-bar-invoke";
    invokeScript.type = "text/javascript";
    invokeScript.src = SCRIPT_URL;
    invokeScript.async = true;
    document.body.appendChild(invokeScript);

    // No cleanup — Social Bar persists for the page session
  }, []);

  // Renders nothing in the React tree; all DOM work is imperative
  return null;
}
