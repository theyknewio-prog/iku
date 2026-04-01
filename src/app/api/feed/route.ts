import { NextRequest, NextResponse } from "next/server";

interface VideoItem {
  id: string;
  title: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  views: string;
  tags: string[];
  source: "xvideos";
}

// Scrape XVideos hentai tag page for video IDs and metadata
async function fetchXVideos(page: number): Promise<VideoItem[]> {
  try {
    const url = `https://www.xvideos.com/tags/hentai/${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Extract video data from the HTML
    const videos: VideoItem[] = [];
    const videoRegex =
      /<div\s+class="thumb-block\s*"[^>]*>[\s\S]*?<a\s+href="\/video\.([a-z0-9]+)\/([^"]*)"[^>]*>[\s\S]*?<img[^>]*data-src="([^"]*)"[^>]*>[\s\S]*?<span class="duration">([^<]*)<\/span>[\s\S]*?<p class="title">[\s\S]*?<a[^>]*>([^<]*)<\/a>/g;

    let match;
    while ((match = videoRegex.exec(html)) !== null) {
      const [, videoId, , thumbnail, duration, title] = match;
      videos.push({
        id: `xv-${videoId}`,
        title: title.trim(),
        videoId,
        thumbnail: thumbnail.startsWith("//") ? `https:${thumbnail}` : thumbnail,
        duration: duration.trim(),
        views: "",
        tags: ["hentai"],
        source: "xvideos",
      });
    }

    // Fallback: simpler regex if the above didn't match
    if (videos.length === 0) {
      const simpleRegex = /\/video\.([a-z0-9]+)\//g;
      const ids = new Set<string>();
      let m;
      while ((m = simpleRegex.exec(html)) !== null) {
        ids.add(m[1]);
      }

      for (const vid of Array.from(ids).slice(0, 20)) {
        videos.push({
          id: `xv-${vid}`,
          title: "Hentai",
          videoId: vid,
          thumbnail: "",
          duration: "",
          views: "",
          tags: ["hentai"],
          source: "xvideos",
        });
      }
    }

    return videos;
  } catch (err) {
    console.error("XVideos fetch error:", err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0");

  try {
    const videos = await fetchXVideos(page);

    return NextResponse.json({
      videos,
      page,
      hasMore: videos.length > 0,
    });
  } catch (error) {
    console.error("Feed fetch error:", error);
    return NextResponse.json(
      { videos: [], page, hasMore: false },
      { status: 500 }
    );
  }
}
