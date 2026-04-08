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
  // DISABLED 2026-04-08 — Adsterra Social Bar was causing aggressive redirects
  // that hijacked browser navigation. The atOptions 'key' was set to a zone ID
  // (28986140) instead of the actual Adsterra publisher key, causing the script
  // to act as a SmartLink redirect.
  //
  // Revenue impact: Adsterra showed 0 impressions, 0 revenue across all 7 zones.
  // Re-enable only after getting the correct publisher key from Adsterra dashboard
  // AND confirming it doesn't redirect.
  //
  // ExoClick handles all ad placements for now.
  return null;
}
