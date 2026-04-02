import type {
  DanbooruPost,
  Video,
  SearchOptions,
  PaginatedResult,
  TagCount,
} from "@/types/video";
import { generateSlug } from "./slugify";

const BASE_URL = "https://danbooru.donmai.us";
const DEFAULT_TAGS = "animated filetype:mp4 rating:e";
const USER_AGENT = "IkuApp/1.0 (server-side)";

// Revalidation intervals (seconds)
const REVALIDATE_POST = 3600; // 1 hour
const REVALIDATE_SEARCH = 600; // 10 minutes (was 5)
const REVALIDATE_TAGS = 86400; // 24 hours

// Rate limiting: 5 req/sec — Danbooru allows 10 but we stay safe
let lastRequest = 0;
const MIN_INTERVAL = 200; // 200ms between requests = 5/sec

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < MIN_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL - elapsed));
  }
  lastRequest = Date.now();
}

async function fetchDanbooru<T>(
  path: string,
  params: Record<string, string> = {},
  revalidate: number = REVALIDATE_SEARCH
): Promise<T> {
  await throttle();

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  let res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate },
  });

  // Retry once on 429 with 2s backoff
  if (res.status === 429) {
    console.warn(`Danbooru 429 rate limited, retrying in 2s: ${url.pathname}`);
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate },
    });
  }

  if (!res.ok) {
    console.error(
      `Danbooru API error: ${res.status} ${res.statusText} for ${url.toString()}`
    );
    return [] as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Type mapper: DanbooruPost -> Video
// ---------------------------------------------------------------------------

/** Build a 720px preview IMAGE url from the 180px thumbnail */
function buildPreviewUrl(thumbnailUrl: string | null): string {
  if (!thumbnailUrl) return "";
  // cdn.donmai.us/180x180/xx/xx/hash.jpg → cdn.donmai.us/720x720/xx/xx/hash.webp
  return thumbnailUrl
    .replace("/180x180/", "/720x720/")
    .replace(/\.jpg$/, ".webp");
}

export function mapPostToVideo(post: DanbooruPost): Video {
  return {
    id: post.id,
    slug: generateSlug(
      post.id,
      post.tag_string_character,
      post.tag_string_copyright
    ),
    url: post.file_url ?? post.large_file_url ?? "",
    thumbnail: post.preview_file_url ?? "",
    preview: buildPreviewUrl(post.preview_file_url),
    score: post.score,
    favorites: post.fav_count,
    tags: splitTags(post.tag_string_general),
    characters: splitTags(post.tag_string_character),
    copyrights: splitTags(post.tag_string_copyright),
    artists: splitTags(post.tag_string_artist),
    width: post.image_width,
    height: post.image_height,
    fileSize: post.file_size,
    duration: post.media_asset?.duration ?? null,
    createdAt: new Date(post.created_at),
    source: "danbooru",
  };
}

function splitTags(tagString: string): string[] {
  if (!tagString || !tagString.trim()) return [];
  return tagString.trim().split(/\s+/);
}

// ---------------------------------------------------------------------------
// Core API functions
// ---------------------------------------------------------------------------

/**
 * Fetch a single post by ID.
 */
export async function getPost(id: number): Promise<Video> {
  const post = await fetchDanbooru<DanbooruPost>(
    `/posts/${id}.json`,
    {},
    REVALIDATE_POST
  );
  return mapPostToVideo(post);
}

/**
 * Search posts with tags, pagination, and sorting.
 * Default query includes `animated filetype:mp4 rating:e`.
 */
export async function searchPosts(
  options: SearchOptions = {}
): Promise<PaginatedResult<Video>> {
  const {
    tags = "",
    page,
    cursor,
    limit = 40,
    order = "score",
  } = options;

  const clampedLimit = Math.min(limit, 200);

  // Danbooru free accounts: max 2 tags.
  // When user provides a tag, we use: rating:e + tag (2 tags)
  // When no tag, we use: animated filetype:mp4 (2 tags — order is a meta-tag, doesn't count)
  // We filter for MP4 files in the results when searching by tag.
  const orderTag =
    order === "score"
      ? "order:score"
      : order === "favcount"
        ? "order:favcount"
        : "order:id_desc";

  let tagQuery: string;
  if (tags) {
    // User tag search: rating:e + tag + order (order is free, doesn't count)
    tagQuery = `rating:e ${tags} ${orderTag}`;
  } else {
    // Default browse: animated filetype:mp4 + order
    tagQuery = `${DEFAULT_TAGS} ${orderTag}`;
  }

  const params: Record<string, string> = {
    tags: tagQuery,
    limit: String(clampedLimit),
  };

  // Cursor-based pagination takes priority
  if (cursor) {
    params.page = `b${cursor}`;
  } else if (page && page > 1) {
    params.page = String(page);
  }

  const posts = await fetchDanbooru<DanbooruPost[]>(
    "/posts.json",
    params,
    REVALIDATE_SEARCH
  );

  // When searching by user tag, filter to only MP4 videos (since we can't use filetype:mp4 tag)
  const filtered = tags
    ? posts.filter((p) => p.file_url?.endsWith(".mp4") || p.file_url?.endsWith(".webm"))
    : posts;

  return {
    data: filtered.map(mapPostToVideo),
    hasMore: posts.length === clampedLimit,
  };
}

/**
 * Get the most used tags on animated content.
 * Uses the tag listing endpoint sorted by post count, filtered to general tags.
 */
export async function getPopularTags(
  limit: number = 50
): Promise<TagCount[]> {
  // Danbooru /tags.json supports search[name_matches] and order=count
  // Category 0 = general tags
  const tags = await fetchDanbooru<
    Array<{ name: string; post_count: number; category: number }>
  >(
    "/tags.json",
    {
      "search[order]": "count",
      "search[category]": "0",
      "search[has_post]": "true",
      limit: String(Math.min(limit, 200)),
    },
    REVALIDATE_TAGS
  );

  return tags.map((t) => ({ name: t.name, count: t.post_count }));
}

/**
 * Get the most used character tags.
 * Category 4 = character tags on Danbooru.
 */
export async function getPopularCharacters(
  limit: number = 50
): Promise<TagCount[]> {
  const tags = await fetchDanbooru<
    Array<{ name: string; post_count: number; category: number }>
  >(
    "/tags.json",
    {
      "search[order]": "count",
      "search[category]": "4",
      "search[has_post]": "true",
      limit: String(Math.min(limit, 200)),
    },
    REVALIDATE_TAGS
  );

  return tags.map((t) => ({ name: t.name, count: t.post_count }));
}

/**
 * Find related posts by looking at the tags of a given post,
 * then searching for posts that share the same character + copyright tags.
 */
export async function getRelatedPosts(
  postId: number,
  limit: number = 12
): Promise<Video[]> {
  // First, fetch the source post to get its tags
  let source: DanbooruPost;
  try {
    source = await fetchDanbooru<DanbooruPost>(
      `/posts/${postId}.json`,
      {},
      REVALIDATE_POST
    );
    if (!source || !source.id) {
      const fallback = await searchPosts({ limit, order: "score" });
      return fallback.data.slice(0, limit);
    }
  } catch {
    const fallback = await searchPosts({ limit, order: "score" });
    return fallback.data.slice(0, limit);
  }

  // Build a query from the post's character and copyright tags
  const characters = splitTags(source.tag_string_character || "");
  const copyrights = splitTags(source.tag_string_copyright || "");

  // Use the first character tag if available, otherwise first copyright
  let relatedTag = "";
  if (characters.length > 0) {
    relatedTag = characters[0];
  } else if (copyrights.length > 0) {
    relatedTag = copyrights[0];
  }

  if (!relatedTag) {
    // Fallback: just return popular posts
    const result = await searchPosts({ limit, order: "score" });
    return result.data.filter((v) => v.id !== postId).slice(0, limit);
  }

  // Use rating:e + relatedTag only (2 tags max for free Danbooru)
  const posts = await fetchDanbooru<DanbooruPost[]>(
    "/posts.json",
    {
      tags: `rating:e ${relatedTag} order:score`,
      limit: String(Math.min(limit + 5, 200)),
    },
    REVALIDATE_SEARCH
  );

  // Filter for MP4/WebM only (since we can't use filetype:mp4 tag)
  return posts
    .filter((p) => p.id !== postId && (p.file_url?.endsWith(".mp4") || p.file_url?.endsWith(".webm")))
    .slice(0, limit)
    .map(mapPostToVideo);
}
