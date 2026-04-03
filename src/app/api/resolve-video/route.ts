import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * GET /api/resolve-video?url=<page_url>
 *
 * Resolves a temporary video stream URL from a page URL using yt-dlp.
 * Results are cached in-memory for 1 hour (URLs typically expire in 2h).
 */

// In-memory cache: pageUrl → { videoUrl, timestamp }
const cache = new Map<string, { videoUrl: string; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now > val.expiresAt) cache.delete(key);
  }
}, 10 * 60 * 1000);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageUrl = searchParams.get("url");

  if (!pageUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Validate it's a known source
  const allowed = [
    "rule34video.com",
    "hentaicity.com",
    "hentaimama.io",
    "hentai.tv",
    "animeidhentai.com",
    "watchhentai.net",
    "hentaiworld.tv",
    "hentaigasm.com",
  ];
  const isAllowed = allowed.some((domain) => pageUrl.includes(domain));
  if (!isAllowed) {
    return NextResponse.json({ error: "unsupported source" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(pageUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      videoUrl: cached.videoUrl,
      cached: true,
    });
  }

  try {
    // Use yt-dlp to extract the best video URL
    const { stdout } = await execAsync(
      `yt-dlp -j --no-download "${pageUrl}"`,
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

    // Cache the result
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
  }
}
