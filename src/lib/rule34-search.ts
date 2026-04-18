import type { Video, PaginatedResult } from "@/types/video";
import { filterBannedContent } from "./content";

const BASE_URL = "https://api.rule34.xxx/index.php";
const API_KEY = process.env.RULE34_API_KEY ?? "";
const USER_ID = process.env.RULE34_USER_ID ?? "";
const USER_AGENT = "IkuApp/1.0 (server-side)";

const REVALIDATE = 21600; // 6h

// Rate limit: 2 req/sec
let lastRequest = 0;
const MIN_INTERVAL = 500;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - elapsed));
  }
  lastRequest = Date.now();
}

interface R34Post {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url: string;
  tags: string;
  score: number;
  width: number;
  height: number;
  created_at: string;
}

function buildSlug(id: number, tags: string): string {
  const firstTag =
    (tags || "")
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") ?? "";
  return firstTag ? `r34-${id}-${firstTag}` : `r34-${id}`;
}

function mapToVideo(post: R34Post): Video | null {
  const url = post.file_url ?? "";
  if (!url) return null;
  if (!url.endsWith(".mp4") && !url.endsWith(".webm")) return null;

  const tagList = post.tags
    ? post.tags.trim().split(/\s+/).filter(Boolean)
    : [];

  return {
    id: post.id,
    slug: buildSlug(post.id, post.tags),
    url,
    thumbnail: post.preview_url ?? "",
    preview: post.sample_url || post.preview_url || "",
    score: post.score ?? 0,
    favorites: 0,
    tags: tagList,
    characters: [],
    copyrights: [],
    artists: [],
    width: post.width ?? 0,
    height: post.height ?? 0,
    fileSize: 0,
    duration: null,
    createdAt: post.created_at ? new Date(post.created_at) : new Date(0),
    source: "rule34",
  };
}

export interface Rule34SearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export async function searchRule34(
  options: Rule34SearchOptions = {},
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "score" } = options;

  await throttle();

  const clampedLimit = Math.min(limit, 100);
  const pid = Math.max(0, page - 1);

  const orderTag =
    order === "score"
      ? "sort:score:desc"
      : order === "date"
        ? "sort:id:desc"
        : "sort:score:desc";

  const baseQuery = tags
    ? `animated video ${tags} ${orderTag}`
    : `animated video ${orderTag}`;

  try {
    const url = `${BASE_URL}?page=dapi&s=post&q=index&json=1&api_key=${API_KEY}&user_id=${USER_ID}&tags=${encodeURIComponent(baseQuery)}&limit=${clampedLimit}&pid=${pid}`;

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: REVALIDATE },
    });

    if (!res.ok) return { data: [], hasMore: false };

    const text = await res.text();
    if (!text || text.startsWith("<")) return { data: [], hasMore: false };

    const posts: R34Post[] = JSON.parse(text);
    if (!Array.isArray(posts)) return { data: [], hasMore: false };

    const videos = posts.map(mapToVideo).filter((v): v is Video => v !== null);

    return {
      data: filterBannedContent(videos),
      hasMore: posts.length === clampedLimit,
    };
  } catch {
    return { data: [], hasMore: false };
  }
}
