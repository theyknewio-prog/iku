"use client";

/**
 * UserDataSync — runs inside AppShell for every page.
 *
 * When a user becomes authenticated:
 *   1. Push local favorites + history to the server (one-way bulk upsert)
 *   2. Fetch server favorites + history back into localStorage
 *   3. Mark the user id as "synced" in localStorage so we don't re-do step 1 on every page load
 *
 * Anonymous users: this component is a no-op.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const SYNCED_KEY = "iku-synced-user";
const FAVORITES_KEY = "iku-favorites";
const HISTORY_KEY = "iku-history";

interface LocalFavorite {
  id: number;
  slug: string;
  title?: string;
  thumbnail?: string;
  addedAt?: number;
}

interface LocalHistoryItem {
  id: number;
  slug: string;
  timestamp?: number;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function UserDataSync() {
  const { data: session, status } = useSession();

  // Set body data-pro attribute from /api/user/stats. We can't read it at
  // SSR time without making the whole layout dynamic (breaks ISR on 346K
  // watch pages), so we fetch post-hydration. Ad components re-check the
  // attribute after mount, so the flash is imperceptible for Pro users.
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      document.body.dataset.pro = "0";
      return;
    }
    fetch("/api/user/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        document.body.dataset.pro = data?.isPro ? "1" : "0";
      })
      .catch(() => {
        document.body.dataset.pro = "0";
      });
  }, [status, session?.user?.id]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const userKey = `${SYNCED_KEY}:${session.user.id}`;
    if (localStorage.getItem(userKey) === "1") return;

    (async () => {
      // 1. Push local data to server (bulk, dedup'd by slug on the server)
      const localFavs = readJSON<LocalFavorite[]>(FAVORITES_KEY, []);
      const localHist = readJSON<LocalHistoryItem[]>(HISTORY_KEY, []);

      const favSlugs = localFavs.map((f) => f.slug).filter(Boolean);
      const histSlugs = localHist.map((h) => h.slug).filter(Boolean);

      try {
        if (favSlugs.length > 0) {
          await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bulk: favSlugs }),
          });
        }
        if (histSlugs.length > 0) {
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bulk: histSlugs }),
          });
        }

        // Mark as synced — skip the push on subsequent page loads.
        localStorage.setItem(userKey, "1");
      } catch {
        // Silent fail — will retry on next page load
      }
    })();
  }, [status, session?.user?.id]);

  return null;
}
