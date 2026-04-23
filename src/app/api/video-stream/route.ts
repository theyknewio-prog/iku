import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import pool from "@/lib/db";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { BANNED_TAGS_ARRAY, containsBannedContent } from "@/lib/content";

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
const limiter = createRateLimiter({
  name: "video-stream",
  max: 30,
  windowMs: 60_000,
});

// L1 cleanup — rate limiter has its own.
if (typeof setInterval !== "undefined") {
  const l1Timer = setInterval(
    () => {
      const now = Date.now();
      for (const [k, v] of l1Cache) if (now > v.expiresAt) l1Cache.delete(k);
    },
    5 * 60 * 1000,
  );
  if (
    typeof (l1Timer as unknown as { unref?: () => void }).unref === "function"
  ) {
    (l1Timer as unknown as { unref: () => void }).unref();
  }
}

async function getFromPgCache(pageUrl: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      "SELECT video_url FROM resolved_urls WHERE page_url = $1 AND expires_at > NOW() LIMIT 1",
      [pageUrl],
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
      [pageUrl, videoUrl],
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
      { timeout: 15000 },
    );
    const data = JSON.parse(stdout);
    return data.url ?? null;
  } catch {
    return null;
  } finally {
    activeYtDlp--;
  }
}

/**
 * Banned-content + dead-row guard.
 * Returns:
 *   "ok"      — URL matches a clean, live row in `videos` → proxy it
 *   "banned"  — URL matches a row flagged by banned-tag filter, or dead_at set
 *   "unknown" — no row matches → don't proxy (reject: we only stream what we ingested)
 *
 * Fixes B3 (bug audit 2026-04-23): before this guard, an attacker could
 * forge `?url=https://rule34video.com/videos/<banned-slug>/` and use iku.gg
 * as an anonymous streaming proxy for content we never validated. That
 * makes us an intermediary for 2257/DMCA-liability content with no paper
 * trail. The ingestion-time banned-content filter in `upsertVideos` was
 * the only line of defence; this adds a request-time check as well.
 */
async function checkPageUrlAllowed(
  pageUrl: string,
): Promise<"ok" | "banned" | "unknown"> {
  try {
    const { rows } = await pool.query<{
      tags: string[];
      characters: string[] | null;
      copyrights: string[] | null;
      dead_at: Date | null;
    }>(
      `SELECT tags, characters, copyrights, dead_at
         FROM videos
         WHERE url = $1 OR page_url = $1
         LIMIT 1`,
      [pageUrl],
    );
    if (rows.length === 0) return "unknown";
    const row = rows[0];
    if (row.dead_at !== null) return "banned";
    if (
      containsBannedContent({
        tags: row.tags || [],
        characters: row.characters || [],
        copyrights: row.copyrights || [],
      })
    ) {
      return "banned";
    }
    // Belt + suspenders: also filter by raw SQL in case a row slipped past
    // containsBannedContent() for some edge reason (stale casing, etc.).
    const banned = BANNED_TAGS_ARRAY;
    const tagHit =
      (row.tags || []).some((t) => banned.includes(t.toLowerCase())) ||
      (row.characters || []).some((c) => banned.includes(c.toLowerCase())) ||
      (row.copyrights || []).some((c) => banned.includes(c.toLowerCase()));
    if (tagHit) return "banned";
    return "ok";
  } catch {
    // On DB error fail closed — better to 500 a legit request than proxy
    // a banned one. Reporting fallback lets ops see these in logs.
    return "unknown";
  }
}

async function resolveUrl(pageUrl: string): Promise<string | null> {
  // L1
  const l1 = l1Cache.get(pageUrl);
  if (l1 && Date.now() < l1.expiresAt) return l1.videoUrl;

  // L2
  const l2 = await getFromPgCache(pageUrl);
  if (l2) {
    l1Cache.set(pageUrl, {
      videoUrl: l2,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return l2;
  }

  // Fresh resolve
  const parsedUrl = new URL(pageUrl);
  let videoUrl: string | null = null;
  try {
    if (
      parsedUrl.hostname === "rule34video.com" ||
      parsedUrl.hostname.endsWith(".rule34video.com")
    ) {
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
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 },
    );
  }

  // Rate limit by IP (prevents bandwidth DoS)
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
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
    "sfmcompile.club",
    // 3dhentai.tube serves MP4s via a rotating fleet of mirrors
    "3dhentai.tube",
    "naughtyhentai.com",
    "watchpornmovie.com",
    "hentaianime.tv",
    "hentaiporn.tube",
    "hentaivideo.tube",
    "eporner.com",
    "porn3dx.com",
    // 8 generic-source CDNs (direct MP4, no yt-dlp resolve)
    "hembed.com", // hanime1 (vdownload.hembed.com)
    "vintageporno.stream", // hentaibros (cdn.*)
    "povblowjob.net", // hentaibros fallback
    "hentaicloud.com", // hentaicloud (www.*)
    "hentaifreak.org", // hentaifreak (media.*)
    "hgasm1.com", // hentaigasm mirror 1
    "hgasm2.com", // hentaigasm mirror 2
    "hgasm3.com", // hentaigasm mirror 3
    "gdvid.info", // hentaimama
    "javprovider.com", // hentaimama fallback
    "hentaiplanet.info", // hentaiplay
    "hentaisea.com", // hentaisea (www.*)
    "pornobuono.com", // hentaisea mirror
    "freakpornos.com", // hentaisea mirror
    "streamhentai.org", // hentaistream (cdn1/cdn2/cdn3.*)
    "b-cdn.net", // porn3dx (Bunny Stream, vz-*.b-cdn.net serves m3u8 + segments)
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
    (domain) =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "unsupported source" }, { status: 400 });
  }

  // Banned-content + dead-row guard (B3). Must run BEFORE any outbound
  // fetch so we never become an anonymous proxy for content we didn't
  // ingest + validate. Runs exactly one indexed DB lookup.
  const allowCheck = await checkPageUrlAllowed(pageUrl);
  if (allowCheck === "banned") {
    return NextResponse.json(
      { error: "content not available" },
      { status: 403 },
    );
  }
  if (allowCheck === "unknown") {
    return NextResponse.json(
      { error: "content not in catalogue" },
      { status: 404 },
    );
  }

  // Fast path: if the URL already points at a playable MP4, skip the
  // yt-dlp/HTML-parse resolve step entirely. The 8 generic sources
  // (hanime1, hentaibros, hentaicloud, hentaifreak, hentaimama, hentaiplay,
  // hentaisea, hentaistream) plus hentaicity store direct MP4 URLs — running
  // yt-dlp on them always 502s. We still proxy to hide the source host and
  // normalise Range handling.
  const pathname = parsed.pathname.toLowerCase();
  const isDirectMp4 =
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".m4v") ||
    pathname.endsWith(".webm");

  // Resolve the page URL to a stream URL (only when we actually need to)
  const streamUrl = isDirectMp4 ? pageUrl : await resolveUrl(pageUrl);
  if (!streamUrl) {
    return NextResponse.json(
      { error: "could not resolve video URL" },
      { status: 502 },
    );
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
    const upstreamTimeout = setTimeout(
      () => upstreamController.abort(),
      20_000,
    );
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
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }

  // Build response headers — pass through content-type, length, range info
  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "video/mp4",
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
