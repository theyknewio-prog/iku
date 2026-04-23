/**
 * GET /api/geo — echoes the Cloudflare-inferred country of the caller.
 *
 * Phase 1 of the geo-waterfall plan (see memory_project_session_2026_04_23).
 * Goal: verify that `cf-ipcountry` actually reaches our Next.js app through
 * Cloudflare → Traefik → container, before wiring ads to branch on it.
 *
 * Response:
 *   { country: "FR", source: "cf-ipcountry" }           when CF sets it
 *   { country: null, source: null, seenHeaders: [...] } when it doesn't
 *
 * The `seenHeaders` fallback lists the geo-ish headers we saw so we can
 * tell whether CF just didn't send `cf-ipcountry` (→ toggle IP Geolocation
 * in CF Network settings) or whether Traefik stripped it mid-flight.
 */
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GEO_HEADER_CANDIDATES = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-real-ip-country",
];

export async function GET(req: NextRequest) {
  let country: string | null = null;
  let source: string | null = null;

  for (const h of GEO_HEADER_CANDIDATES) {
    const v = req.headers.get(h);
    if (v && v.length === 2) {
      country = v.toUpperCase();
      source = h;
      break;
    }
  }

  // V13 (security audit 2026-04-23): seenHeaders + cfRay were debug
  // leftovers that revealed our Cloudflare colo + header shape. Strip
  // them from the production response.
  return NextResponse.json(
    { country, source },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
