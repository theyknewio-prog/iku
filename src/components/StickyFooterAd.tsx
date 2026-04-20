"use client";

/**
 * StickyFooterAd — sticky bottom mobile ad above the bottom nav.
 *
 * Visible only on viewports <768px. Sits at bottom: 64px (above the 60px
 * mobile nav + 4px gap). Dismissible per session.
 *
 * Ship #4 2026-04-20: switched from ExoClick mobileBanner300x50 (which was
 * delivering 160-wide creatives into a 300-wide zone, half-empty / cropped
 * appearance) to HentaiPros 300x100 — guaranteed-fill iframe, exact size,
 * no dynamic <ins> injection that triggers iOS reflow → also fixes the
 * "bottom nav detaches on iOS Chrome" regression Sab reported.
 *
 * Pro users never see this.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "iku_sticky_footer_dismissed";
const HENTAI_PROS_300x100_SPOT = 10001817; // AdultForce hentai-niche, 300x100

export function StickyFooterAd() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hide on routes where a sticky bottom is wrong (immersive feed,
    // auth, checkout, pricing).
    if (
      pathname === "/feed" ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/preview/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout")
    ) {
      setVisible(false);
      return;
    }
    if (document.body.dataset.pro === "1") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
  }, [pathname]);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="sticky-footer-ad" aria-label="Advertisement">
      <iframe
        title="hentaipros-300x100"
        aria-label="Advertisement"
        src={`//a.adtng.com/get/${HENTAI_PROS_300x100_SPOT}?ata=iku.media.gg`}
        width={300}
        height={100}
        loading="lazy"
        scrolling="no"
        frameBorder={0}
        allowTransparency
        marginHeight={0}
        marginWidth={0}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{
          backgroundColor: "transparent",
          border: "none",
          display: "block",
          maxWidth: "100%",
        }}
      />
      <button
        className="sticky-footer-ad__close"
        onClick={dismiss}
        aria-label="Close advertisement"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
