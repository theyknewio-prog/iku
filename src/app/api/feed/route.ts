import { NextRequest, NextResponse } from "next/server";

interface VideoItem {
  id: string;
  title: string;
  videoId: string;
  videoUrl: string;
  thumbnail: string;
  duration: string;
  views: string;
  tags: string[];
  source: "gelbooru" | "xvideos";
  type: "direct" | "embed";
}

const GELBOORU_API_KEY =
  "3ed16caf49d543883a94b9e8beeb56804c4bbdd577bbb22697579e11d84aca13c755ad81e6c3caf03c8b158f07b92097466280dfec9ea35313b61efd3bcc1a41";
const GELBOORU_USER_ID = "1943515";

// Fetch animated videos from Gelbooru (237K+ videos)
async function fetchGelbooru(page: number): Promise<VideoItem[]> {
  try {
    const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&tags=animated+sort:score&json=1&limit=20&pid=${page}&api_key=${GELBOORU_API_KEY}&user_id=${GELBOORU_USER_ID}`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) return [];

    const data = await res.json();
    const posts = data.post || [];
    if (!Array.isArray(posts)) return [];

    return posts
      .filter(
        (p: any) =>
          p.file_url &&
          (p.file_url.endsWith(".mp4") || p.file_url.endsWith(".webm"))
      )
      .map((p: any) => {
        const tags = (p.tags || "")
          .split(" ")
          .filter(
            (t: string) =>
              t.length > 2 &&
              !t.includes("_id") &&
              !["animated", "video", "sound", "highres", "lowres"].includes(t)
          )
          .slice(0, 6);

        return {
          id: `gel-${p.id}`,
          title: p.title || tags.slice(0, 3).join(" ").replace(/_/g, " "),
          videoId: String(p.id),
          videoUrl: p.file_url,
          thumbnail: p.preview_url || "",
          duration: "",
          views: String(p.score || 0),
          tags,
          source: "gelbooru" as const,
          type: "direct" as const,
        };
      });
  } catch (err) {
    console.error("Gelbooru fetch error:", err);
    return [];
  }
}

// Fetch hentai from XVideos (100K+ videos)
async function fetchXVideos(page: number): Promise<VideoItem[]> {
  try {
    const url = `https://www.xvideos.com/tags/hentai/${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const videos: VideoItem[] = [];

    // Extract video IDs
    const regex = /\/video\.([a-z0-9]+)\//g;
    const ids = new Set<string>();
    let m;
    while ((m = regex.exec(html)) !== null) {
      ids.add(m[1]);
    }

    // Extract titles
    const titleRegex =
      /title="([^"]*)"[^>]*href="\/video\.\w+\/[^"]*"/g;
    const titles: string[] = [];
    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1]);
    }

    let i = 0;
    for (const vid of Array.from(ids).slice(0, 20)) {
      videos.push({
        id: `xv-${vid}`,
        title: titles[i] || "Hentai",
        videoId: vid,
        videoUrl: `https://www.xvideos.com/embedframe/${vid}`,
        thumbnail: "",
        duration: "",
        views: "",
        tags: ["hentai"],
        source: "xvideos",
        type: "embed",
      });
      i++;
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
  const source = searchParams.get("source") || "all";

  try {
    let videos: VideoItem[] = [];

    if (source === "all" || source === "gelbooru") {
      const gelbooru = await fetchGelbooru(page);
      videos.push(...gelbooru);
    }

    if (source === "all" || source === "xvideos") {
      const xvideos = await fetchXVideos(page);
      videos.push(...xvideos);
    }

    // Shuffle for variety
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }

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
