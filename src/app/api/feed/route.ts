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

// Fetch hentai videos from hanime.tv search API
async function fetchHanime(page: number): Promise<VideoItem[]> {
  try {
    const res = await fetch("https://search.htv-services.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search_text: "",
        tags: [],
        tags_mode: "AND",
        brands: [],
        blacklist: [],
        order_by: "likes",
        ordering: "desc",
        page,
      }),
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const hits = typeof data.hits === "string" ? JSON.parse(data.hits) : data.hits;
    if (!Array.isArray(hits)) return [];

    // For each video, get the stream URL
    const videos: VideoItem[] = [];

    for (const hit of hits.slice(0, 12)) {
      try {
        const videoRes = await fetch(
          `https://hanime.tv/api/v8/video?id=${hit.slug}`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          }
        );

        if (!videoRes.ok) continue;

        const videoData = await videoRes.json();
        const servers = videoData.videos_manifest?.servers;
        let streamUrl = "";

        if (servers && servers.length > 0) {
          const streams = servers[0].streams;
          if (streams && streams.length > 0) {
            // Get the stream URL — construct full URL
            const stream = streams[0];
            if (stream.url) {
              streamUrl = stream.url;
              // hanime uses a video_stream_group_id for the actual video
              if (stream.video_stream_group_id) {
                streamUrl = stream.url.replace(
                  "stream.m3u8",
                  `${stream.video_stream_group_id}.m3u8`
                );
              }
            }
          }
        }

        if (!streamUrl) continue;

        const tags = (hit.tags || videoData.hentai_video?.hentai_tags || [])
          .map((t: any) => (typeof t === "string" ? t : t.text))
          .filter(Boolean)
          .slice(0, 6);

        videos.push({
          id: `hanime-${hit.id}`,
          title: hit.name || videoData.hentai_video?.name || "",
          embedUrl: streamUrl,
          thumbnail: hit.cover_url || hit.poster_url || "",
          duration: hit.duration_in_ms
            ? `${Math.floor(hit.duration_in_ms / 60000)}:${String(
                Math.floor((hit.duration_in_ms % 60000) / 1000)
              ).padStart(2, "0")}`
            : "",
          views: formatViews(hit.views || 0),
          tags,
          source: "hanime",
        });
      } catch {
        continue;
      }
    }

    return videos;
  } catch (err) {
    console.error("Hanime fetch error:", err);
    return [];
  }
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0");

  try {
    const videos = await fetchHanime(page);

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
