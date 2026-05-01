"use client";

/**
 * AffiliateSlideIn — non-intrusive bottom-right slide-in affiliate card.
 *
 * Replaces HilltopInPagePush (fake browser-notif scripts) with a clean
 * single-card CTA that appears 12s after mount. Frequency cap: 1/session
 * via sessionStorage. Excluded from: /feed, /pricing, /checkout, /login,
 * /signup. Pro users are also excluded (body[data-pro="1"]).
 *
 * Animation is pure CSS — no GSAP dependency.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AffiliateCard from "./AffiliateCard";
import { getAffiliate } from "@/lib/affiliates";

const SESSION_KEY = "iku-slide-in-shown";

const EXCLUDED_PATHS = ["/feed", "/pricing", "/checkout", "/login", "/signup"];

export function AffiliateSlideIn() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip excluded routes
    if (
      EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      return;
    }

    // Skip Pro users
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1") {
      return;
    }

    // Frequency cap — once per session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      /* private browsing */
    }

    const timer = setTimeout(() => {
      setVisible(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* noop */
      }
    }, 12000);

    return () => clearTimeout(timer);
    // Re-evaluate on route change so a new page gives the timer a fresh
    // chance — but the sessionStorage guard still caps it to 1/session.
  }, [pathname]);

  const aff = getAffiliate("candy-ai");
  if (!visible || !aff) return null;

  const dismiss = () => setVisible(false);

  return (
    <div
      className="aff-slide-in"
      role="complementary"
      aria-label="Sponsored suggestion"
      aria-live="polite"
    >
      <button
        className="aff-slide-in__close"
        onClick={dismiss}
        aria-label="Dismiss"
        type="button"
      >
        ✕
      </button>
      <AffiliateCard
        slug={aff.slug}
        brand={aff.brand}
        tagline={aff.tagline}
        thumbnail={aff.thumbnail}
        rating={aff.rating}
        badge={aff.badge}
        variant="compact"
      />
    </div>
  );
}
