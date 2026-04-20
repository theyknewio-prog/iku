"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { EXOCLICK_SCRIPT_URL } from "@/lib/ad-config";

export function AdScript() {
  const [isPro, setIsPro] = useState(true);

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  if (isPro) return null;

  return (
    <Script
      src={EXOCLICK_SCRIPT_URL}
      strategy="afterInteractive"
      id="exoclick-ad-provider"
    />
  );
}
