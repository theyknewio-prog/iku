import { NextRequest, NextResponse } from "next/server";

interface DanbooruPost {
  id: number;
  score: number;
  file_url: string;
  large_file_url: string;
  preview_file_url: string;
  file_size: number;
  tag_string_general: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  image_width: number;
  image_height: number;
  file_ext: string;
  rating: string;
}

interface FeedVideo {
  id: number;
  videoUrl: string;
  thumbnail: string;
  score: number;
  tags: string[];
  character: string;
  artist: string;
  copyright: string;
  width: number;
  height: number;
  size: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const tag = searchParams.get("tag") || "";

  // Build Danbooru query — animated MP4s, sorted by score, explicit only
  let tags = "animated filetype:mp4 order:score rating:e";
  if (tag) {
    tags = `${tag} animated filetype:mp4 order:score rating:e`;
  }

  try {
    const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tags)}&limit=20&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "iku.gg/1.0" },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { videos: [], page, hasMore: false, error: `Danbooru ${res.status}` },
        { status: 502 }
      );
    }

    const posts: DanbooruPost[] = await res.json();

    const videos: FeedVideo[] = posts
      .filter((p) => p.file_url && p.file_ext === "mp4")
      .map((p) => {
        // Get meaningful tags (skip very common ones)
        const skipTags = new Set([
          "1boy", "1girl", "animated", "video", "sound", "highres",
          "absurdres", "commentary", "english_commentary", "third-party_edit",
        ]);
        const tags = (p.tag_string_general || "")
          .split(" ")
          .filter((t) => t.length > 2 && !skipTags.has(t))
          .slice(0, 6);

        const character = (p.tag_string_character || "").split(" ")[0] || "";
        const artist = (p.tag_string_artist || "").split(" ")[0] || "";
        const copyright = (p.tag_string_copyright || "").split(" ")[0] || "";

        return {
          id: p.id,
          videoUrl: p.file_url,
          thumbnail: p.preview_file_url || p.large_file_url || "",
          score: p.score,
          tags,
          character,
          artist,
          copyright,
          width: p.image_width,
          height: p.image_height,
          size: p.file_size,
        };
      });

    return NextResponse.json({
      videos,
      page,
      hasMore: videos.length === 20,
    });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json(
      { videos: [], page, hasMore: false, error: "fetch failed" },
      { status: 500 }
    );
  }
}
