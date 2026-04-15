import { NextRequest, NextResponse } from "next/server";
import { getFeedKeyset, decodeCursor, encodeCursor } from "@/lib/content";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * Diversify a Shorts feed batch so no two consecutive cards share the
 * same primary character or copyright. Walks the list once; when a
 * collision is detected, pulls the next non-matching item forward.
 * O(n²) worst case but n ≤ 60 and the input is usually already
 * ~diverse, so in practice it's ~O(n).
 */
function diversifyFeed<T extends { character: string; copyright: string }>(
  list: T[]
): T[] {
  if (list.length < 3) return list;
  const out = [...list];
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i];
    const b = out[i + 1];
    const collides =
      (a.character && a.character === b.character) ||
      (a.copyright && a.copyright === b.copyright);
    if (!collides) continue;
    // Find the next item further ahead that doesn't collide with a
    let swap = -1;
    for (let j = i + 2; j < out.length; j++) {
      const c = out[j];
      const ok =
        (!a.character || a.character !== c.character) &&
        (!a.copyright || a.copyright !== c.copyright);
      if (ok) {
        swap = j;
        break;
      }
    }
    if (swap > 0) {
      [out[i + 1], out[swap]] = [out[swap], out[i + 1]];
    }
  }
  return out;
}

const limiter = createRateLimiter({ name: "feed", max: 30, windowMs: 60_000 });

// On the very first request (no cursor) we want session variety — pick a
// random sort from this set so two users landing on /feed don't get the
// exact same top-scoring clips. After that, the cursor locks the sort.
const FIRST_PAGE_SORTS: Array<"score" | "date" | "favcount"> = [
  "score",
  "favcount",
  "date",
];

export async function GET(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
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
  let order: "score" | "date" | "favcount" | "duration";
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
      // First page (no client cursor) = random starting offset inside top 5000.
      // Refreshing /feed now shows a different slice each time while keeping
      // the O(log n) keyset pagination for subsequent pages.
      randomStart: !cursor,
      randomStartMax: 5000,
    });

    // CDN base URL — all videos route through our Cloudflare R2 cache-through
    // Worker. First view = fetch from source + cache in R2. Subsequent views =
    // served from Cloudflare edge (~10-30ms globally). This eliminates the
    // proxy latency for Rule34Video/WP sources and adds edge caching for all.
    const CDN = process.env.CDN_URL || "https://iku-cdn.mejdi-sabri.workers.dev";

    // Filter: must have a playable URL (direct or via proxy) and stay under
    // a reasonable streaming budget.
    const videos = data
      .filter((v) => (v.url || v.pageUrl) && (v.fileSize === 0 || v.fileSize < 60_000_000))
      .map((v) => {
        // Route ALL videos through CDN cache for edge-cached playback.
        // Use base64url-encoded path to avoid Chrome's URL safety check
        // which rejects <video src> containing encoded URLs in query params.
        const sourceUrl = v.url || (v.pageUrl ? v.pageUrl : "");
        const b64 = sourceUrl ? Buffer.from(sourceUrl).toString("base64url") : "";
        const playableUrl = b64 ? `${CDN}/v/${b64}` : "";

        return {
          id: v.id,
          slug: v.slug,
          // Both field names for compatibility (HomeFeed uses `url`, SwipeFeed uses `videoUrl`)
          url: playableUrl,
          videoUrl: playableUrl,
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
        };
      });

    // Diversify: prevent runs of the same character, copyright, or source
    // in consecutive feed slots. Without this the Shorts feed regularly
    // showed 10 Chun-Li or 10 Overwatch clips in a row because the DB sort
    // surfaces high-scoring franchises as clusters. Simple interleave:
    // walk the list, if position i+1 shares (character || copyright) with
    // position i, pull the next non-matching item forward.
    const diversified = diversifyFeed(videos);

    return NextResponse.json({
      videos: diversified,
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
