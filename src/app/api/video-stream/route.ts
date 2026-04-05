import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const execFileAsync = promisify(execFile);

/**
 * GET /api/video-stream?url=<page_url>
 *
 * Streaming proxy for Rule34Video + WP sources.
 *
 * These sources bind their stream URLs to the fetcher's IP (via DDoS-Guard
 * cookies or signed tokens). A URL resolved on our server is valid from
 * our server IP but returns 403 when the user's browser tries it directly.
 *
 * This endpoint:
 *   1. Resolves the page URL to a video URL (L1/L2 cache → direct parse → yt-dlp)
 *   2. Fetches the video from upstream using OUR server's session
 *   3. Streams bytes back to the client, passing through Range headers
 *      for seeking support
 *
 * Bandwidth cost: real but manageable on a Hetzner CX33 (20TB/mo included).
 * Caching: the resolved URL is cached but the video bytes are not (would
 * require disk storage). Upstream CDNs already cache aggressively.
 */

// Share the resolved URL cache with /api/resolve-video (same module state)
const l1Cache = new Map<string, { videoUrl: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// Rate limit: 30 video stream requests per minute per IP.
// Higher than resolve-video (10/min) because a single video playback triggers
// multiple range requests, but still bounded to prevent bandwidth abuse.
const limiter = createRateLimiter({ name: "video-stream", max: 30, windowMs: 60_000 });

// L1 cleanup — rate limiter has its own.
if (typeof setInterval !== "undefined") {
  const l1Timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of l1Cache) if (now > v.expiresAt) l1Cache.delete(k);
  }, 5 * 60 * 1000);
  if (typeof (l1Timer as unknown as { unref?: () => void }).unref === "function") {
    (l1Timer as unknown as { unref: () => void }).unref();
  }
}

async function getFromPgCache(pageUrl: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      "SELECT video_url FROM resolved_urls WHERE page_url = $1 AND expires_at > NOW() LIMIT 1",
      [pageUrl]
    );
    return rows[0]?.video_url ?? null;
  } catch {
    return null;
  }
}

async function setInPgCache(pageUrl: string, videoUrl: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO resolved_urls (page_url, video_url, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')
       ON CONFLICT (page_url) DO UPDATE
       SET video_url = EXCLUDED.video_url, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [pageUrl, videoUrl]
    );
  } catch {
    // Best-effort
  }
}

async function resolveRule34Video(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const html = await res.text();
    const patterns: RegExp[] = [
      /video_alt_url3:\s*'([^']+)'/,
      /video_alt_url2:\s*'([^']+)'/,
      /video_alt_url:\s*'([^']+)'/,
      /video_url:\s*'([^']+)'/,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].includes(".mp4")) return match[1];
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

let activeYtDlp = 0;
const MAX_YT_DLP = 3;
async function resolveViaYtDlp(pageUrl: string): Promise<string | null> {
  if (activeYtDlp >= MAX_YT_DLP) throw new Error("BUSY");
  activeYtDlp++;
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["-j", "--no-download", pageUrl],
      { timeout: 15000 }
    );
    const data = JSON.parse(stdout);
    return data.url ?? null;
  } catch {
    return null;
  } finally {
    activeYtDlp--;
  }
}

async function resolveUrl(pageUrl: string): Promise<string | null> {
  // L1
  const l1 = l1Cache.get(pageUrl);
  if (l1 && Date.now() < l1.expiresAt) return l1.videoUrl;

  // L2
  const l2 = await getFromPgCache(pageUrl);
  if (l2) {
    l1Cache.set(pageUrl, { videoUrl: l2, expiresAt: Date.now() + CACHE_TTL_MS });
    return l2;
  }

  // Fresh resolve
  const parsedUrl = new URL(pageUrl);
  let videoUrl: string | null = null;
  try {
    if (parsedUrl.hostname === "rule34video.com" || parsedUrl.hostname.endsWith(".rule34video.com")) {
      videoUrl = await resolveRule34Video(pageUrl);
    }
    if (!videoUrl) {
      videoUrl = await resolveViaYtDlp(pageUrl);
    }
  } catch {
    return null;
  }

  if (videoUrl) {
    l1Cache.set(pageUrl, { videoUrl, expiresAt: Date.now() + CACHE_TTL_MS });
    setInPgCache(pageUrl, videoUrl);
  }
  return videoUrl;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageUrl = searchParams.get("url");

  if (!pageUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Rate limit by IP (prevents bandwidth DoS)
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // SSRF guard — same domain whitelist as resolve-video
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

  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "https required" }, { status: 400 });
  }
  const isAllowed = allowedDomains.some(
    (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "unsupported source" }, { status: 400 });
  }

  // Resolve the page URL to a stream URL
  const streamUrl = await resolveUrl(pageUrl);
  if (!streamUrl) {
    return NextResponse.json({ error: "could not resolve video URL" }, { status: 502 });
  }

  // Proxy the video, passing through Range header for seek support
  const rangeHeader = request.headers.get("range");
  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    Referer: pageUrl,
  };
  if (rangeHeader) upstreamHeaders.Range = rangeHeader;

  let upstream: Response;
  try {
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), 20_000);
    upstream = await fetch(streamUrl, {
      headers: upstreamHeaders,
      redirect: "follow",
      signal: upstreamController.signal,
    });
    clearTimeout(upstreamTimeout);
  } catch (err) {
    console.error("[video-stream] upstream fetch failed:", err);
    return NextResponse.json(
      { error: "upstream unreachable" },
      { status: 502 }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `upstream returned ${upstream.status}` },
      { status: 502 }
    );
  }

  // Build response headers — pass through content-type, length, range info
  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "video/mp4"
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
