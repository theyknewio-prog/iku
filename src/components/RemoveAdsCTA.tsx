"use client";

/**
 * RemoveAdsCTA — Subtle bar below ads nudging users to Go Pro for ad-free.
 * Only shows for non-Pro, non-logged-in users.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export function RemoveAdsCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hide for Pro users (body data-pro="1" set by root layout)
    if (document.body.dataset.pro === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="remove-ads-cta">
      <Link href="/pricing" className="remove-ads-cta__link">
        <span className="remove-ads-cta__emoji" aria-hidden>&#x1F624;</span>
        <span className="remove-ads-cta__text">
          Tired of ads? <strong>Go Pro</strong> — ad-free experience
        </span>
        <span className="remove-ads-cta__arrow" aria-hidden>&rsaquo;</span>
      </Link>
    </div>
  );
}
