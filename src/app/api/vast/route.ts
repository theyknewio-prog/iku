/**
 * GET /api/vast — server-side VAST XML fetcher + parser.
 *
 * Browser fetch of the ExoClick VAST endpoint is blocked by CORS. We
 * proxy server-side, follow Wrapper VASTAdTagURI redirects (max 3
 * hops per the spec), parse the InLine ad into a simple JSON shape
 * the client can consume, and return everything it needs to play
 * the ad video + fire tracking pixels.
 *
 * Response:
 *   { ok: true, mediaUrl, duration, skipOffset, clickThrough,
 *     impressions: [...], tracking: { start, firstQuartile, midpoint,
 *     thirdQuartile, complete, skip, pause, resume, click }[] }
 * or { ok: false, reason } when there's no ad to serve.
 */

import { NextResponse, type NextRequest } from "next/server";
import { AD_ZONES } from "@/lib/ad-config";

export const dynamic = "force-dynamic";

const MAX_WRAPPER_HOPS = 3;
const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function cdata(s: string | undefined | null): string {
  if (!s) return "";
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : s).trim();
}

function parseDuration(s: string): number {
  const m = s.match(/(\d+):(\d+):(\d+)/);
  if (!m) return 15;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

type ParsedAd = {
  mediaUrl: string;
  duration: number;
  skipOffset: number;
  clickThrough: string;
  impressions: string[];
  tracking: Record<string, string[]>;
};

async function resolveVast(url: string, hops: number): Promise<ParsedAd | null> {
  if (hops > MAX_WRAPPER_HOPS) return null;
  let xml: string;
  try {
    xml = await fetchWithTimeout(url);
  } catch {
    return null;
  }
  if (!xml || xml.length < 50) return null;

  // Wrapper = follow VASTAdTagURI and merge impressions/tracking.
  const wrapper = xml.match(/<VASTAdTagURI[^>]*>([\s\S]*?)<\/VASTAdTagURI>/i);
  if (wrapper) {
    const childUrl = cdata(wrapper[1]);
    const parentImpressions = Array.from(xml.matchAll(/<Impression[^>]*>([\s\S]*?)<\/Impression>/gi))
      .map((m) => cdata(m[1]))
      .filter(Boolean);
    const parentTracking = collectTracking(xml);
    const child = await resolveVast(childUrl, hops + 1);
    if (!child) return null;
    return {
      ...child,
      impressions: [...parentImpressions, ...child.impressions],
      tracking: mergeTracking(parentTracking, child.tracking),
    };
  }

  // InLine — extract MediaFile, tracking, clickthrough.
  const mediaFiles = Array.from(
    xml.matchAll(/<MediaFile\b[^>]*>([\s\S]*?)<\/MediaFile>/gi)
  )
    .map((m) => ({
      attrs: m[0],
      src: cdata(m[1]),
    }))
    .filter((m) => m.src.includes("http"));
  if (mediaFiles.length === 0) return null;

  // Prefer MP4 progressive over other types.
  const mp4 =
    mediaFiles.find((m) => /type=\s*"video\/mp4"/i.test(m.attrs)) ||
    mediaFiles[0];
  const mediaUrl = mp4.src;

  const durationMatch = xml.match(/<Duration>([\s\S]*?)<\/Duration>/i);
  const duration = durationMatch ? parseDuration(cdata(durationMatch[1])) : 15;

  const skipMatch = xml.match(/skipoffset\s*=\s*"([^"]+)"/i);
  const skipOffset = skipMatch ? parseDuration(skipMatch[1]) : 5;

  const clickMatch = xml.match(/<ClickThrough[^>]*>([\s\S]*?)<\/ClickThrough>/i);
  const clickThrough = clickMatch ? cdata(clickMatch[1]) : "";

  const impressions = Array.from(
    xml.matchAll(/<Impression[^>]*>([\s\S]*?)<\/Impression>/gi)
  )
    .map((m) => cdata(m[1]))
    .filter(Boolean);

  const tracking = collectTracking(xml);

  // Click-tracking pixels — we fire these on click alongside the clickThrough.
  const clickTrackMatches = Array.from(
    xml.matchAll(/<ClickTracking[^>]*>([\s\S]*?)<\/ClickTracking>/gi)
  ).map((m) => cdata(m[1])).filter(Boolean);
  if (clickTrackMatches.length) {
    tracking.click = [...(tracking.click ?? []), ...clickTrackMatches];
  }

  return { mediaUrl, duration, skipOffset, clickThrough, impressions, tracking };
}

function collectTracking(xml: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const regex = /<Tracking\s+event="([^"]+)"[^>]*>([\s\S]*?)<\/Tracking>/gi;
  for (const m of xml.matchAll(regex)) {
    const event = m[1];
    const url = cdata(m[2]);
    if (!url) continue;
    out[event] = [...(out[event] ?? []), url];
  }
  return out;
}

function mergeTracking(
  a: Record<string, string[]>,
  b: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = [...(out[k] ?? []), ...v];
  }
  return out;
}

export async function GET(req: NextRequest) {
  const zone = req.nextUrl.searchParams.get("zone") || AD_ZONES.exoclick.videoPreroll;
  // Validate zone is numeric — don't let callers inject an arbitrary URL.
  if (!/^\d+$/.test(zone)) {
    return NextResponse.json({ ok: false, reason: "bad_zone" }, { status: 400 });
  }

  const vastUrl = `https://s.magsrv.com/v1/vast.php?idzone=${zone}`;
  const ad = await resolveVast(vastUrl, 0);
  if (!ad) {
    return NextResponse.json(
      { ok: false, reason: "no_fill" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, ...ad },
    { headers: { "Cache-Control": "no-store" } }
  );
}
