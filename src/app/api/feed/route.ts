import { NextRequest, NextResponse } from "next/server";
import { getFeedKeyset, decodeCursor, encodeCursor } from "@/lib/content";

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

// On the very first request (no cursor) we want session variety — pick a
// random sort from this set so two users landing on /feed don't get the
// exact same top-scoring clips. After that, the cursor locks the sort.
const FIRST_PAGE_SORTS: Array<"score" | "date" | "favcount"> = [
  "score",
  "favcount",
  "date",
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
  const rawCursor = searchParams.get("cursor");
  const cursor = decodeCursor(rawCursor);
  const sortParam = searchParams.get("sort");
  const tag = searchParams.get("tag") || "";
  const sourceParam = searchParams.get("source") || "all";
  const source =
    sourceParam === "danbooru"
      ? "danbooru"
      : sourceParam === "gelbooru"
        ? "gelbooru"
        : "all";

  // Resolve sort order:
  //   1. cursor's order wins (must stay stable across keyset pages)
  //   2. explicit ?sort= param wins next (filter UI)
  //   3. otherwise pick a random session sort for variety
  let order: "score" | "date" | "favcount";
  if (cursor?.order) {
    order = cursor.order;
  } else if (sortParam === "date" || sortParam === "favcount" || sortParam === "score") {
    order = sortParam;
  } else {
    order = FIRST_PAGE_SORTS[Math.floor(Math.random() * FIRST_PAGE_SORTS.length)];
  }

  try {
    const { data, nextCursor } = await getFeedKeyset({
      // Pull a wider batch so the URL/size filter still yields ~20-30 playable rows.
      limit: 60,
      order,
      cursor,
      tags: tag || undefined,
      source,
      // Feed cards without a thumbnail look broken on swipe — exclude.
      requireThumbnail: true,
    });

    // Filter: must have a direct playable URL and stay under a reasonable
    // streaming budget (60MB keeps the cap for pathological files without
    // dropping the long-tail of 2-3 min high-quality clips).
    const videos = data
      .filter((v) => v.url && (v.fileSize === 0 || v.fileSize < 60_000_000))
      .map((v) => ({
        id: v.id,
        slug: v.slug,
        // Both field names for compatibility (HomeFeed uses `url`, SwipeFeed uses `videoUrl`)
        url: v.url,
        videoUrl: v.url,
        thumbnail: v.thumbnail,
        score: v.score,
        tags: v.tags.slice(0, 6),
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

    return NextResponse.json({
      videos,
      order,
      cursor: nextCursor ? encodeCursor(nextCursor) : null,
      hasMore: nextCursor !== null,
    });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json(
      { videos: [], cursor: null, hasMore: false, order },
      { status: 500 }
    );
  }
}
