import { NextRequest, NextResponse } from "next/server";
import { getVideos } from "@/lib/content";

// Rate limit: 30 requests/min per IP
const feedRateLimit = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of feedRateLimit) {
    if (now > val.resetAt) feedRateLimit.delete(key);
  }
  if (feedRateLimit.size > 10000) {
    let i = 0;
    for (const key of feedRateLimit.keys()) {
      if (i++ >= feedRateLimit.size - 10000) break;
      feedRateLimit.delete(key);
    }
  }
}, 5 * 60_000);

// How many "pages" worth of catalog we skip to spread sessions across the
// content library. Gelbooru/Danbooru support page numbers up to a few hundred
// before returning empty results, so keep the ceiling modest.
const MAX_RANDOM_OFFSET = 40;

// Rotate sort order so consecutive pages feel different even within one session.
const ORDER_ROTATION: Array<"score" | "date" | "favcount"> = [
  "score",
  "date",
  "favcount",
  "date",
  "score",
];

export async function GET(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
    || "unknown";
  const now = Date.now();
  const rl = feedRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 30) {
      return NextResponse.json(
        { error: "too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    rl.count++;
  } else {
    feedRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const sort = searchParams.get("sort") || "score";
  const tag = searchParams.get("tag") || "";
  const sourceParam = searchParams.get("source") || "all";
  const source =
    sourceParam === "danbooru"
      ? "danbooru"
      : sourceParam === "gelbooru"
        ? "gelbooru"
        : "all";

  // When a sort is explicitly requested by the user (e.g. filter UI), honour it.
  // Otherwise let the rotation decide.
  const hasExplicitSort = searchParams.has("sort");
  const explicitOrder =
    sort === "date" ? "date" : sort === "favcount" ? "favcount" : "score";

  // Rotation: each page index (0-based) picks a different sort order so
  // scrolling through the feed alternates between high-score, newest, popular.
  const rotatedOrder = ORDER_ROTATION[(page - 1) % ORDER_ROTATION.length];
  const order = hasExplicitSort ? explicitOrder : rotatedOrder;

  // Session-level random offset — this changes on every request because the
  // server runs Math.random() fresh each time.  The offset is added to the
  // requested page so two users on "page 1" actually hit different slices of
  // the catalog.  We only apply the offset on page 1 so that subsequent
  // infinite-scroll pages stay coherent (page 2 = offset+2, etc.).
  //
  // The offset is passed back to the client so the frontend can include it in
  // subsequent page requests, keeping the session slice consistent.
  const rawOffset = searchParams.get("offset");
  const sessionOffset =
    rawOffset !== null
      ? Math.max(0, Math.min(parseInt(rawOffset), MAX_RANDOM_OFFSET))
      : Math.floor(Math.random() * MAX_RANDOM_OFFSET);

  // Effective catalog page: user's logical page + session offset.
  const catalogPage = page + sessionOffset;

  try {
    const { data, hasMore } = await getVideos({
      limit: 20,
      page: catalogPage,
      order,
      tags: tag || undefined,
      source,
    });

    // Filter: must have a URL and be under the file-size limit.
    const videos = data
      .filter((v) => v.url && v.fileSize < 15_000_000)
      .map((v) => ({
        id: v.id,
        slug: v.slug,
        // Both field names for compatibility (HomeFeed uses `url`, SwipeFeed uses `videoUrl`)
        url: v.url,
        videoUrl: v.url,
        thumbnail: v.thumbnail,
        score: v.score,
        tags: v.tags.slice(0, 6),
        // Both formats: arrays for HomeFeed, singular for SwipeFeed/VideoCard
        characters: v.characters.slice(0, 3),
        artists: v.artists.slice(0, 2),
        copyrights: v.copyrights.slice(0, 2),
        character: v.characters[0] || "",
        artist: v.artists[0] || "",
        copyright: v.copyrights[0] || "",
        duration: v.duration,
        width: v.width || 0,
        height: v.height || 0,
        size: v.fileSize || 0,
      }));

    return NextResponse.json({ videos, page, hasMore, offset: sessionOffset });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ videos: [], page, hasMore: false, offset: sessionOffset }, { status: 500 });
  }
}
