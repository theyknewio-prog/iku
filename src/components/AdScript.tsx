"use client";

/**
 * AdScript — Global ExoClick ad provider script loader.
 *
 * Loads the ExoClick ad-provider.js once via next/script with lazyOnload
 * strategy (non-blocking, after page is interactive). Skips entirely for
 * Pro users (detected via data-pro attribute on <body>).
 */

import Script from "next/script";
import { useEffect, useState } from "react";
import { EXOCLICK_SCRIPT_URL } from "@/lib/ad-config";

export function AdScript() {
  const [isPro, setIsPro] = useState(true); // default to true = no ads until checked

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  if (isPro) return null;

  return (
    <Script
      src={EXOCLICK_SCRIPT_URL}
      strategy="lazyOnload"
      id="exoclick-ad-provider"
    />
  );
}
