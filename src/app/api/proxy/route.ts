import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * Video proxy for Gelbooru CDN.
 *
 * Gelbooru blocks hotlinking (302 → hotlink.php) unless Referer is gelbooru.com.
 * This route fetches the video server-side with the correct Referer and streams it
 * back to the client. Supports Range requests for seeking.
 *
 * Usage: /api/proxy?url=https://video-cdn4.gelbooru.com/images/xx/xx/hash.mp4
 */

const ALLOWED_HOSTS = [
  "video-cdn4.gelbooru.com",
  "video-cdn3.gelbooru.com",
  "video-cdn2.gelbooru.com",
  "video-cdn1.gelbooru.com",
  "img3.gelbooru.com",
  "img2.gelbooru.com",
  "img1.gelbooru.com",
  "media.gelbooru.com",
  "gelbooru.com",
];

const limiter = createRateLimiter({ name: "proxy", max: 60, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Validate host — strict domain + protocol check
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // Only allow https to prevent SSRF via file://, gopher://, etc.
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only https allowed" }, { status: 400 });
  }

  // Block non-standard ports
  if (parsed.port && parsed.port !== "443") {
    return NextResponse.json({ error: "Non-standard port" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  // Forward Range header for seeking support
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; IkuProxy/1.0)",
    Referer: "https://gelbooru.com/",
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  try {
    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status },
      );
    }

    // Build response headers
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type") || "video/mp4";
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "https://iku.gg");
    // Cache proxied videos for 24h on client, 7d on CDN
    responseHeaders.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800",
    );

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Proxy fetch error:", err);
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
  }
}
