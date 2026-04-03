import { NextRequest, NextResponse } from "next/server";
import { getVideos } from "@/lib/content";

export async function GET(request: NextRequest) {
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

  const order = sort === "date" ? "date" : sort === "favcount" ? "favcount" : "score";

  try {
    // Both sources — Gelbooru videos proxied through /api/proxy
    const { data, hasMore } = await getVideos({
      limit: 20,
      page,
      order,
      tags: tag || undefined,
      source: "all",
    });

    // Filter out broken videos and large files
    const videos = data
      .filter((v) => v.url && v.fileSize < 15_000_000)
      .map((v) => ({
        id: v.id,
        slug: v.slug,
        videoUrl: v.url,
        thumbnail: v.thumbnail,
        score: v.score,
        tags: v.tags.slice(0, 6),
        character: v.characters[0] || "",
        artist: v.artists[0] || "",
        copyright: v.copyrights[0] || "",
        duration: v.duration,
      }));

    return NextResponse.json({ videos, page, hasMore });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ videos: [], page, hasMore: false }, { status: 500 });
  }
}
