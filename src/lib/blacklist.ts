import type { Video } from "@/types/video";

const BLACKLIST_KEY = "iku-blacklist";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BLACKLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(tags: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(tags));
  } catch {
    // storage full or unavailable
  }
}

export function addToBlacklist(tag: string): void {
  if (typeof window === "undefined") return;
  const existing = read();
  const normalised = tag.trim().toLowerCase();
  if (!normalised || existing.includes(normalised)) return;
  write([...existing, normalised]);
}

export function removeFromBlacklist(tag: string): void {
  if (typeof window === "undefined") return;
  write(read().filter((t) => t !== tag));
}

export function getBlacklist(): string[] {
  return read();
}

export function isBlacklisted(tag: string): boolean {
  if (typeof window === "undefined") return false;
  return read().includes(tag.toLowerCase());
}

export function filterByBlacklist(videos: Video[]): Video[] {
  if (typeof window === "undefined") return videos;
  const blacklist = read();
  if (!blacklist.length) return videos;
  return videos.filter(
    (v) => !v.tags.some((t) => blacklist.includes(t.toLowerCase())),
  );
}
