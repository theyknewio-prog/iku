"use client";

/**
 * FooterAdBlock — universal above-footer leaderboard.
 *
 * 728x90 desktop / 300x250 mobile, mounted from AppShell so every page
 * (except /feed, /login, /signup, /pricing, /checkout, /preview) gets
 * one extra ad slot at the bottom of the scroll path. Hentaigasm and
 * HentaiCity both run a footer banner here — universal, no per-page
 * wiring needed.
 *
 * Pro users skip via the existing data-pro="1" body attribute check
 * (HentaiProsBanner is a static iframe, so we gate the wrapper instead).
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HentaiProsBanner } from "./HentaiProsBanner";

const SKIP_PREFIXES = [
  "/feed",
  "/login",
  "/signup",
  "/pricing",
  "/checkout",
  "/preview",
];

export function FooterAdBlock() {
  const pathname = usePathname();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    setIsPro(document.body?.dataset.pro === "1");
  }, []);

  if (!pathname) return null;
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (isPro) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "32px 0 16px",
      }}
      aria-label="Advertisement"
    >
      <HentaiProsBanner format="728x90" mobileFormat="300x250" />
    </div>
  );
}
