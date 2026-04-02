import { NextRequest, NextResponse } from "next/server";
import { searchPosts, mapPostToVideo } from "@/lib/danbooru";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const sort = searchParams.get("sort") || "score";
  const tag = searchParams.get("tag") || "";

  const order = sort === "date" ? "date" : sort === "favcount" ? "favcount" : "score";

  try {
    const { data, hasMore } = await searchPosts({
      limit: 20,
      page,
      order,
      tags: tag || undefined,
    });

    const videos = data.map((v) => ({
      id: v.id,
      slug: v.slug,
      url: v.url,
      thumbnail: v.thumbnail,
      score: v.score,
      tags: v.tags,
      characters: v.characters,
      copyrights: v.copyrights,
      artists: v.artists,
      duration: v.duration,
    }));

    return NextResponse.json({ videos, page, hasMore });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ videos: [], page, hasMore: false }, { status: 500 });
  }
}
