"use client";

import { useEffect } from "react";

const ZONE_SRC =
  "https://ss.mrmnd.com/static/24320e85-7e20-47d7-9b73-7d45e3b86466.js";

export function MondiadInPagePush() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.body?.dataset.pro === "1") return;
    if (document.querySelector('script[data-mondiad-ipp="1"]')) return;
    const s = document.createElement("script");
    s.src = ZONE_SRC;
    s.async = true;
    s.dataset.mondiadIpp = "1";
    document.body.appendChild(s);
  }, []);

  return null;
}
