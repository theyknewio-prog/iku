import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * GET /api/resolve-video?url=<page_url>
 *
 * Resolves a temporary video stream URL from a page URL using yt-dlp.
 * Results are cached in-memory for 1 hour (URLs typically expire in 2h).
 */

// In-memory cache: pageUrl → { videoUrl, expiresAt }
// Bounded to prevent memory leaks — evict oldest when full
const cache = new Map<string, { videoUrl: string; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 500;

// Rate limit: IP → { count, resetAt }
// Bounded to prevent memory leaks from many unique IPs
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 resolves per minute per IP
const RATE_LIMIT_MAX_SIZE = 10000;

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now > val.expiresAt) cache.delete(key);
  }
  for (const [key, val] of rateLimit) {
    if (now > val.resetAt) rateLimit.delete(key);
  }
  // Hard cap: if still too large after cleanup, evict oldest entries
  if (cache.size > CACHE_MAX_SIZE) {
    const toDelete = cache.size - CACHE_MAX_SIZE;
    let i = 0;
    for (const key of cache.keys()) {
      if (i++ >= toDelete) break;
      cache.delete(key);
    }
  }
  if (rateLimit.size > RATE_LIMIT_MAX_SIZE) {
    const toDelete = rateLimit.size - RATE_LIMIT_MAX_SIZE;
    let i = 0;
    for (const key of rateLimit.keys()) {
      if (i++ >= toDelete) break;
      rateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Max concurrent yt-dlp processes
let activeResolves = 0;
const MAX_CONCURRENT = 3;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageUrl = searchParams.get("url");

  if (!pageUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Rate limit by IP — use last IP in x-forwarded-for (closest to reverse proxy)
  // or fall back to x-real-ip which is set by trusted proxies like Traefik/Coolify
  const xRealIp = request.headers.get("x-real-ip");
  const xForwardedFor = request.headers.get("x-forwarded-for");
  const ip = xRealIp || (xForwardedFor ? xForwardedFor.split(",").pop()?.trim() : null) || "unknown";
  const now = Date.now();
  const rl = rateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "too many requests, try again in a minute" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    rl.count++;
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
  }

  // Validate it's a known source — strict domain check via URL parsing
  const allowedDomains = [
    "rule34video.com",
    "hentaicity.com",
    "hentaimama.io",
    "hentai.tv",
    "animeidhentai.com",
    "watchhentai.net",
    "hentaiworld.tv",
    "hentaigasm.com",
  ];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  // Only allow https
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "https required" }, { status: 400 });
  }
  const isAllowed = allowedDomains.some(
    (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "unsupported source" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(pageUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ videoUrl: cached.videoUrl, cached: true });
  }

  // Concurrency guard
  if (activeResolves >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: "server busy, try again shortly" },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }

  activeResolves++;
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["-j", "--no-download", pageUrl],
      { timeout: 15000 }
    );

    const data = JSON.parse(stdout);
    const videoUrl = data.url;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "could not extract video URL" },
        { status: 502 }
      );
    }

    cache.set(pageUrl, {
      videoUrl,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return NextResponse.json({
      videoUrl,
      cached: false,
      duration: data.duration ?? null,
      title: data.title ?? null,
    });
  } catch (error) {
    console.error("yt-dlp resolve error:", error);
    return NextResponse.json(
      { error: "failed to resolve video" },
      { status: 502 }
    );
  } finally {
    activeResolves--;
  }
}
