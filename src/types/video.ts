// Raw Danbooru API response shape (fields we care about)
export interface DanbooruPost {
  id: number;
  file_url: string | null;
  preview_file_url: string | null;
  large_file_url: string | null;
  score: number;
  tag_string_general: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  image_width: number;
  image_height: number;
  file_size: number;
  media_asset: {
    duration: number | null;
    [key: string]: unknown;
  };
  created_at: string;
  tag_count_general: number;
  tag_count_character: number;
  fav_count: number;
  up_score: number;
  down_score: number;
  rating: string;
  file_ext: string;
}

// Cleaned-up type used in components
export interface Video {
  id: number;
  /** Internal PG primary key. Distinct from `id` (which is the source's
   *  id, e.g. the Rule34 post id). Required by the per-video unlock API
   *  which references videos.pk via FK. */
  pk?: number;
  slug: string;
  url: string;
  thumbnail: string;
  preview: string;
  score: number;
  favorites: number;
  tags: string[];
  characters: string[];
  copyrights: string[];
  artists: string[];
  width: number;
  height: number;
  fileSize: number;
  duration: number | null;
  createdAt: Date;
  source: "danbooru" | "gelbooru" | "rule34" | "rule34video" | "wp" | "hentaicity" | "hentaigasm";
  /** Scraped title (rule34video, WP sources). Empty for booru sources. */
  title?: string;
  /** Original page URL for sources that need proxy resolution (rule34video, WP). */
  pageUrl?: string;
}

export interface SearchOptions {
  tags?: string;
  page?: number;
  cursor?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
}

export interface TagCount {
  name: string;
  count: number;
}
