const HISTORY_KEY = "iku-history";
const MAX_HISTORY = 200;

export interface HistoryItem {
  id: number;
  slug: string;
  timestamp: number;
  /** Optional cover image — populated from 2026-04-05 onwards; older entries
   *  saved before this change will be missing it until the user rewatches. */
  thumbnail?: string;
  /** Optional display title for the card — same backfill story as thumbnail. */
  title?: string;
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

/** Fire-and-forget server sync. Skipped for anon users (would 401 and log a
 *  console error on ~99% of pageviews). PostHog tracking still fires for all. */
function syncToServer(slug: string): void {
  if (typeof window === "undefined") return;

  const isAuthed = document.body?.dataset.auth === "1";
  if (isAuthed) {
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {
      /* silent */
    });

    // Scoring event for video_view (streaks etc.) — logged-in only.
    import("./score-client").then(({ recordScoreEvent }) => {
      recordScoreEvent("video_view", { slug });
    });
  }

  // PostHog: track video view for everyone (anon analytics matter).
  import("./analytics").then(({ track, EVENTS }) => {
    track(EVENTS.VIDEO_VIEW, { slug });
  });
}

export function addToHistory(
  id: number,
  slug: string,
  thumbnail?: string,
  title?: string,
): void {
  if (typeof window === "undefined") return;
  const existing = read().filter((item) => item.id !== id);
  const updated: HistoryItem[] = [
    { id, slug, timestamp: Date.now(), thumbnail, title },
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
  // Also clear server-side (logged-in only — anon has nothing server-side and
  // the DELETE would 401). Log real failures so a logged-in user's cleared
  // history doesn't resurface on next device login.
  if (document.body?.dataset.auth === "1") {
    fetch("/api/history", { method: "DELETE" }).catch((err) => {
      console.error("clearHistory server sync failed:", err);
    });
  }
}
