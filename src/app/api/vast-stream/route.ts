/**
 * GET /api/vast-stream?url=<encoded MediaFile URL>
 *
 * Streams a VAST MediaFile through our origin so we don't have to
 * whitelist every adult-ad CDN domain in the CSP `media-src`. Each
 * ad creative may be hosted on a different CDN (aucdn.net, afcdn.net,
 * sacdnssedge.com, adsacdn.com, etc.) — proxying lets the browser
 * fetch from `iku.gg` (already trusted) and the upstream change
 * weekly without touching CSP.
 *
 * Range support: forwards the Range request header so HTML5 <video>
 * can seek (not super useful for 15-30s prerolls but cheap to support).
 *
 * Allowed upstream hosts are restricted to a known set so this can't
 * be used as an open proxy.
 */

import { type NextRequest } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_HOST_SUFFIXES = [
  // ExoClick / magsrv creative CDNs
  "aucdn.net",
  "afcdn.net",
  "sacdnssedge.com",
  "adsacdn.com",
  "stripcash.com",
  "magsrv.com",
  "exoclick.com",
  "exosrv.com",
  "xlivrdr.com",
  "saawsedge.com",
  "bxcdn.net",
  "bkcdn.net",
  "exdynsrv.com",
  "realsrv.com",
  // HilltopAds creative CDNs (observed 2026-04-18)
  "silent-basis.pro",
  "difficultblock.com",
  "bsnsrv.com",
  "hmoracle.com",
  "cdn-player.com",
];

function hostAllowed(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith("." + s));
}

const limiter = createRateLimiter({
  name: "vast-stream",
  max: 60,
  windowMs: 60_000,
});

export async function GET(req: NextRequest) {
  if (limiter.consume(getClientIp(req))) {
    return new Response("rate limited", { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !hostAllowed(target)) {
    return new Response("forbidden host", { status: 403 });
  }

  const range = req.headers.get("range") ?? undefined;
  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });

  const headers = new Headers();
  for (const k of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
