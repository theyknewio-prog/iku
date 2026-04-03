import type { Video, PaginatedResult } from "@/types/video";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = "https://gelbooru.com/index.php";
const API_KEY =
  "3ed16caf49d543883a94b9e8beeb56804c4bbdd577bbb22697579e11d84aca13c755ad81e6c3caf03c8b158f07b92097466280dfec9ea35313b61efd3bcc1a41";
const USER_ID = "1943515";
const USER_AGENT = "IkuApp/1.0 (server-side)";

// Revalidation in seconds
const REVALIDATE_SEARCH = 600;

// Rate limit: 1 req/sec for Gelbooru (stricter than Danbooru)
let lastGelbooruRequest = 0;
const MIN_INTERVAL = 1000; // 1000ms = 1/sec

// ---------------------------------------------------------------------------
// Raw Gelbooru API types
// ---------------------------------------------------------------------------

interface GelbooruAttributes {
  limit: number;
  offset: number;
  count: number;
}

export interface GelbooruPost {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url: string;
  tags: string;
  score: number;
  source: string;
  width: number;
  height: number;
  created_at: string;
  // Gelbooru does not expose duration or file_size in the standard JSON response
  file_size?: number;
}

interface GelbooruResponse {
  "@attributes": GelbooruAttributes;
  post: GelbooruPost[] | GelbooruPost | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastGelbooruRequest;
  if (elapsed < MIN_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_INTERVAL - elapsed)
    );
  }
  lastGelbooruRequest = Date.now();
}

async function fetchGelbooru(
  params: Record<string, string>,
  revalidate: number = REVALIDATE_SEARCH
): Promise<GelbooruResponse | null> {
  await throttle();

  const url = new URL(BASE_URL);
  // Fixed API parameters
  url.searchParams.set("page", "dapi");
  url.searchParams.set("s", "post");
  url.searchParams.set("q", "index");
  url.searchParams.set("json", "1");
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("user_id", USER_ID);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate },
    });
  } catch (err) {
    console.error("Gelbooru fetch network error:", err);
    return null;
  }

  // Retry once on 429 with 3s back-off (stricter source)
  if (res.status === 429) {
    console.warn("Gelbooru 429 rate limited, retrying in 3s");
    await new Promise((r) => setTimeout(r, 3000));
    try {
      res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate },
      });
    } catch (err) {
      console.error("Gelbooru retry network error:", err);
      return null;
    }
  }

  if (!res.ok) {
    console.error(
      `Gelbooru API error: ${res.status} ${res.statusText}`
    );
    return null;
  }

  try {
    return (await res.json()) as GelbooruResponse;
  } catch (err) {
    console.error("Gelbooru JSON parse error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Slug generation — prefix with "gel-" to avoid collision with Danbooru IDs
// ---------------------------------------------------------------------------

function buildGelbooruSlug(id: number, tags: string): string {
  const firstTag = (tags || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") ?? "";

  return firstTag ? `gel-${id}-${firstTag}` : `gel-${id}`;
}

// ---------------------------------------------------------------------------
// Type mapper: GelbooruPost -> Video
// ---------------------------------------------------------------------------

export function mapGelbooruToVideo(post: GelbooruPost): Video | null {
  const url = post.file_url ?? "";
  if (!url) return null; // Skip posts with no video URL

  const tagList = post.tags
    ? post.tags
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    : [];

  return {
    id: post.id,
    slug: buildGelbooruSlug(post.id, post.tags),
    url,
    thumbnail: post.preview_url ?? "",
    // Gelbooru does not have a separate "720p preview" — use sample_url when available
    preview: post.sample_url || post.preview_url || "",
    score: post.score ?? 0,
    favorites: 0, // Gelbooru API does not expose favorite counts
    tags: tagList,
    characters: [], // Gelbooru tags are not categorised in the post response
    copyrights: [],
    artists: [],
    width: post.width ?? 0,
    height: post.height ?? 0,
    fileSize: post.file_size ?? 0,
    duration: null, // Not available in Gelbooru post response
    createdAt: post.created_at ? new Date(post.created_at) : new Date(0),
    source: "gelbooru",
  };
}

// ---------------------------------------------------------------------------
// Normalise post array — Gelbooru returns a single object when count === 1
// ---------------------------------------------------------------------------

function normalisePosts(raw: GelbooruPost[] | GelbooruPost | undefined): GelbooruPost[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GelbooruSearchOptions {
  tags?: string;
  /** Zero-based page index (pid). Converts from 1-based page number internally. */
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

/**
 * Search Gelbooru for animated MP4 video posts.
 * Gracefully returns an empty result on any failure.
 */
export async function searchGelbooru(
  options: GelbooruSearchOptions = {}
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "score" } = options;

  const clampedLimit = Math.min(limit, 100);
  // Gelbooru uses 0-based pid
  const pid = Math.max(0, page - 1);

  const orderTag =
    order === "score"
      ? "sort:score"
      : order === "favcount"
        ? "sort:score" // Gelbooru has no favcount sort; fall back to score
        : "sort:updated"; // "date" -> sort:updated

  // Base tags: animated + video + rating:explicit
  const baseQuery = tags
    ? `animated video rating:explicit ${tags} ${orderTag}`
    : `animated video rating:explicit ${orderTag}`;

  let data: PaginatedResult<Video>;

  try {
    const json = await fetchGelbooru({
      tags: baseQuery,
      limit: String(clampedLimit),
      pid: String(pid),
    });

    if (!json) {
      return { data: [], hasMore: false };
    }

    const posts = normalisePosts(json.post);
    // Keep only MP4 — Gelbooru serves WebM and other formats too
    const videos = posts
      .filter(
        (p) =>
          p.file_url?.endsWith(".mp4") || p.file_url?.endsWith(".webm")
      )
      .map(mapGelbooruToVideo)
      .filter((v): v is Video => v !== null);

    data = {
      data: videos,
      hasMore: posts.length === clampedLimit,
    };
  } catch (err) {
    console.error("searchGelbooru error:", err);
    data = { data: [], hasMore: false };
  }

  return data;
}

/**
 * Fetch a single Gelbooru post by ID.
 */
export async function getGelbooruPost(id: number): Promise<Video | null> {
  try {
    const json = await fetchGelbooru({
      tags: `id:${id}`,
      limit: "1",
    });
    if (!json) return null;
    const posts = normalisePosts(json.post);
    if (posts.length === 0) return null;
    const video = mapGelbooruToVideo(posts[0]);
    return video;
  } catch {
    return null;
  }
}
