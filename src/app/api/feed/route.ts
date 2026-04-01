import { NextRequest, NextResponse } from "next/server";

interface VideoItem {
  id: string;
  title: string;
  embedUrl: string;
  thumbnail: string;
  duration: string;
  views: string;
  tags: string[];
  source: string;
}

// Fetch hentai videos from Rule34 API (animated content — WebM/MP4)
async function fetchRule34(page: number): Promise<VideoItem[]> {
  const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&tags=video+sort:score&json=1&limit=20&pid=${page}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) return [];

  const posts = await res.json();
  if (!Array.isArray(posts)) return [];

  return posts
    .filter((p: any) => p.file_url && (p.file_url.endsWith(".mp4") || p.file_url.endsWith(".webm")))
    .map((p: any) => ({
      id: `r34-${p.id}`,
      title: (p.tags || "").split(" ").slice(0, 6).join(" "),
      embedUrl: p.file_url,
      thumbnail: p.preview_url || p.sample_url || "",
      duration: "",
      views: String(p.score || 0),
      tags: (p.tags || "").split(" ").filter((t: string) => t.length > 2).slice(0, 8),
      source: "rule34",
    }));
}

// Fetch from Gelbooru API (animated content)
async function fetchGelbooru(page: number): Promise<VideoItem[]> {
  const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&tags=video+sort:score&json=1&limit=20&pid=${page}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) return [];

  const data = await res.json();
  const posts = data.post || data;
  if (!Array.isArray(posts)) return [];

  return posts
    .filter((p: any) => p.file_url && (p.file_url.endsWith(".mp4") || p.file_url.endsWith(".webm")))
    .map((p: any) => ({
      id: `gel-${p.id}`,
      title: (p.tags || "").split(" ").slice(0, 6).join(" "),
      embedUrl: p.file_url,
      thumbnail: p.preview_url || "",
      duration: "",
      views: String(p.score || 0),
      tags: (p.tags || "").split(" ").filter((t: string) => t.length > 2).slice(0, 8),
      source: "gelbooru",
    }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0");
  const tag = searchParams.get("tag") || "";

  try {
    // Fetch from multiple sources in parallel
    const [rule34Videos, gelbooruVideos] = await Promise.all([
      fetchRule34(page),
      fetchGelbooru(page),
    ]);

    // Merge and shuffle
    let videos = [...rule34Videos, ...gelbooruVideos];

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
    return NextResponse.json({ videos: [], page, hasMore: false }, { status: 500 });
  }
}
