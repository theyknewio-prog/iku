import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import pool from "@/lib/db";
import { startWarmup } from "@/lib/url-warmup";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// Kick off the background warmup loop on first module load.
// Singleton inside, safe to call repeatedly.
startWarmup();

const execFileAsync = promisify(execFile);

/**
 * GET /api/resolve-video?url=<page_url>
 *
 * Resolves a temporary video stream URL from a page URL.
 *
 * Two-tier cache:
 *   L1 (memory, per-container) — 500 entries max, 1h TTL, lost on restart.
 *   L2 (PostgreSQL, persistent) — unlimited, 1h TTL, survives restarts.
 *
 * Resolution strategy:
 *   1. rule34video.com → direct HTML fetch + regex (≈380ms, 3.7× faster than yt-dlp)
 *   2. Everything else → yt-dlp fallback (≈1.4s)
 */

// L1: In-memory cache — fast path for hot entries
const l1Cache = new Map<string, { videoUrl: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (URLs typically expire in 2h)
const L1_MAX_SIZE = 500;

// Rate limit: 10/min/IP (yt-dlp path is expensive — keep tight)
const limiter = createRateLimiter({ name: "resolve-video", max: 10, windowMs: 60_000 });

// Periodic cleanup — L1 cache expiry + PG GC. Rate limiter cleans itself.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of l1Cache) {
    if (now > val.expiresAt) l1Cache.delete(key);
  }
  if (l1Cache.size > L1_MAX_SIZE) {
    const toDelete = l1Cache.size - L1_MAX_SIZE;
    let i = 0;
    for (const key of l1Cache.keys()) {
      if (i++ >= toDelete) break;
      l1Cache.delete(key);
    }
  }
  // Purge expired rows from PG (best-effort — see comment in catch).
  pool
    .query("DELETE FROM resolved_urls WHERE expires_at < NOW()")
    .catch((err) => {
      // GC failure just means the table grows a bit — not user-facing. Log so
      // we notice if it's persistent (e.g. DB permissions regression).
      console.warn("[resolve-video] resolved_urls GC failed:", err?.message ?? err);
    });
}, 5 * 60 * 1000);
if (typeof (cleanupTimer as unknown as { unref?: () => void }).unref === "function") {
  (cleanupTimer as unknown as { unref: () => void }).unref();
}

// Max concurrent resolve processes (yt-dlp fallback path)
let activeResolves = 0;
const MAX_CONCURRENT = 3;

/* ── Direct HTML parser for rule34video.com ─────────────────────
 *
 * Rule34Video embeds MP4 URLs directly in the HTML page as JS variables:
 *   video_url:      '...4107566_360.mp4/?v-acctoken=...'
 *   video_alt_url:  '...4107566_480p.mp4/?v-acctoken=...'
 *   video_alt_url2: '...4107566_720p.mp4/?v-acctoken=...'
 *   video_alt_url3: '...4107566_1080p.mp4/?v-acctoken=...'
 *
 * We prefer the highest available quality.
 */
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

    // Prefer highest quality first: 1080p → 720p → 480p → 360p
    const patterns: Array<[string, RegExp]> = [
      ["1080p", /video_alt_url3:\s*'([^']+)'/],
      ["720p", /video_alt_url2:\s*'([^']+)'/],
      ["480p", /video_alt_url:\s*'([^']+)'/],
      ["360p", /video_url:\s*'([^']+)'/],
    ];

    for (const [, pattern] of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].includes(".mp4")) {
        return match[1];
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/* ── yt-dlp fallback for unknown sources ───────────────────────── */
async function resolveViaYtDlp(pageUrl: string): Promise<string | null> {
  if (activeResolves >= MAX_CONCURRENT) {
    throw new Error("BUSY");
  }
  activeResolves++;
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
    activeResolves--;
  }
}

/* ── PG cache helpers ──────────────────────────────────────────── */
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
    // Best-effort — cache miss is not fatal
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageUrl = searchParams.get("url");

  if (!pageUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "too many requests, try again in a minute" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Validate allowed domains (SSRF guard)
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
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "https required" }, { status: 400 });
  }
  const isAllowed = allowedDomains.some(
    (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "unsupported source" }, { status: 400 });
  }

  // ── L1 cache (memory) ───────────────────────────
  const l1 = l1Cache.get(pageUrl);
  if (l1 && Date.now() < l1.expiresAt) {
    return NextResponse.json({ videoUrl: l1.videoUrl, cached: "l1" });
  }

  // ── L2 cache (PostgreSQL) ───────────────────────
  const l2 = await getFromPgCache(pageUrl);
  if (l2) {
    // Warm L1 for subsequent hits in the same container
    l1Cache.set(pageUrl, { videoUrl: l2, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ videoUrl: l2, cached: "l2" });
  }

  // ── Resolve ─────────────────────────────────────
  let videoUrl: string | null = null;
  try {
    // Fast path: direct HTML parse for rule34video (78% of catalog)
    if (parsedUrl.hostname === "rule34video.com" || parsedUrl.hostname.endsWith(".rule34video.com")) {
      videoUrl = await resolveRule34Video(pageUrl);
    }

    // Fallback: yt-dlp (for WP sites and rule34video edge cases)
    if (!videoUrl) {
      videoUrl = await resolveViaYtDlp(pageUrl);
    }
  } catch (err) {
    if (err instanceof Error && err.message === "BUSY") {
      return NextResponse.json(
        { error: "server busy, try again shortly" },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    console.error("resolve error:", err);
  }

  if (!videoUrl) {
    return NextResponse.json({ error: "could not extract video URL" }, { status: 502 });
  }

  // Store in both caches
  const expiresAt = Date.now() + CACHE_TTL_MS;
  l1Cache.set(pageUrl, { videoUrl, expiresAt });
  // Fire and forget PG write
  setInPgCache(pageUrl, videoUrl);

  return NextResponse.json({ videoUrl, cached: false });
}
