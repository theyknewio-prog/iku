import type { Video } from "@/types/video";
import { containsBannedContent, BANNED_TAGS_ARRAY } from "./content";
import { pool } from "./db";
import { memoize } from "./memo";

const BASE_URL = "https://api.rule34.xxx/index.php";
const API_KEY = process.env.RULE34_API_KEY ?? "";
const USER_ID = process.env.RULE34_USER_ID ?? "";
const USER_AGENT = "IkuApp/1.0 (server-side)";

const REVALIDATE = 86400; // 24h

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

async function _getRule34Post(id: number): Promise<Video | null> {
  // PG-first: faster and uses our curated tags (avoids live API tag mismatch)
  try {
    const { rows } = await pool.query(
      `SELECT * FROM videos
       WHERE source = 'rule34' AND source_id = $1
         AND NOT (tags && $2::text[])
         AND NOT (COALESCE(characters, ARRAY[]::text[]) && $2::text[])
         AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $2::text[])
       LIMIT 1`,
      [id, BANNED_TAGS_ARRAY],
    );
    if (rows.length > 0) {
      const row = rows[0];
      const video: Video = {
        id: row.id,
        slug: row.slug,
        url: row.url || "",
        thumbnail: row.thumbnail || "",
        preview: row.preview || row.thumbnail || "",
        score: row.score || 0,
        favorites: row.favorites || 0,
        tags: row.tags || [],
        characters: row.characters || [],
        copyrights: row.copyrights || [],
        artists: row.artists || [],
        width: row.width || 0,
        height: row.height || 0,
        fileSize: row.file_size || 0,
        duration: row.duration || null,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        source: "rule34",
      };
      if (containsBannedContent(video)) return null;
      return video;
    }
  } catch {
    // PG failed, fall through
  }

  // Fallback: live API
  try {
    const url = `${BASE_URL}?page=dapi&s=post&q=index&json=1&api_key=${API_KEY}&user_id=${USER_ID}&tags=id:${id}&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: REVALIDATE },
    });

    if (!res.ok) return null;

    const text = await res.text();
    if (!text || text.startsWith("<")) return null;

    const json = JSON.parse(text);
    if (!Array.isArray(json) || json.length === 0) return null;

    const video = mapToVideo(json[0]);
    if (!video || containsBannedContent(video)) return null;
    return video;
  } catch {
    return null;
  }
}
export const getRule34Post = memoize(
  "rule34-post",
  _getRule34Post,
  5 * 60 * 1000,
);
