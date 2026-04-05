const HISTORY_KEY = "iku-history";
const MAX_HISTORY = 200;

export interface HistoryItem {
  id: number;
  slug: string;
  timestamp: number;
}

function read(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable
  }
}

/** Fire-and-forget server sync. 401 for anon users is ignored. */
function syncToServer(slug: string): void {
  if (typeof window === "undefined") return;
  fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  }).catch(() => {
    /* silent — anon users return 401 */
  });

  // Fire scoring event for video_view (silently handles anon + streaks)
  import("./score-client").then(({ recordScoreEvent }) => {
    recordScoreEvent("video_view", { slug });
  });

  // PostHog: track video view
  import("./analytics").then(({ track, EVENTS }) => {
    track(EVENTS.VIDEO_VIEW, { slug });
  });
}

export function addToHistory(id: number, slug: string): void {
  if (typeof window === "undefined") return;
  const existing = read().filter((item) => item.id !== id);
  const updated: HistoryItem[] = [
    { id, slug, timestamp: Date.now() },
    ...existing,
  ].slice(0, MAX_HISTORY);
  write(updated);
  syncToServer(slug);
}

export function getHistory(): HistoryItem[] {
  return read();
}

export function isWatched(id: number): boolean {
  if (typeof window === "undefined") return false;
  return read().some((item) => item.id === id);
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  write([]);
  // Also clear server-side (fire-and-forget, 401 for anon)
  fetch("/api/history", { method: "DELETE" }).catch(() => {});
}
