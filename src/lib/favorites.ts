const FAVORITES_KEY = "iku-favorites";

export interface FavoriteItem {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  addedAt: number;
}

function read(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: FavoriteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Fire-and-forget server sync. Returns 401 for anon users, which we ignore.
 */
function syncToServer(method: "POST" | "DELETE", slug: string): void {
  if (typeof window === "undefined") return;
  const url =
    method === "DELETE"
      ? `/api/favorites?slug=${encodeURIComponent(slug)}`
      : "/api/favorites";
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify({ slug }) : undefined,
  }).catch(() => {
    /* silent — anon users return 401, offline returns network error */
  });
}

/**
 * Toggle a video in/out of favorites.
 * Returns the new favorited state (true = now favorited).
 */
export function toggleFavorite(video: {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
}): boolean {
  if (typeof window === "undefined") return false;
  const existing = read();
  const idx = existing.findIndex((f) => f.id === video.id);
  if (idx !== -1) {
    write(existing.filter((f) => f.id !== video.id));
    syncToServer("DELETE", video.slug);
    return false;
  }
  write([
    ...existing,
    {
      id: video.id,
      slug: video.slug,
      title: video.title,
      thumbnail: video.thumbnail,
      addedAt: Date.now(),
    },
  ]);
  syncToServer("POST", video.slug);
  return true;
}

export function isFavorite(id: number): boolean {
  if (typeof window === "undefined") return false;
  return read().some((f) => f.id === id);
}

export function getFavorites(): FavoriteItem[] {
  return read();
}

export function clearFavorites(): void {
  if (typeof window === "undefined") return;
  write([]);
}
