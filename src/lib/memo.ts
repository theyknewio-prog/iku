/**
 * memo.ts — Simple TTL memoization for expensive async calls.
 *
 * Used to cache PG query results (popular tags, popular characters, etc.)
 * at the application layer. Complements Next.js ISR — ISR caches the
 * rendered HTML, this caches the raw data so that SSR on a cold route
 * still completes in <50ms instead of hitting PG multiple times.
 */

interface MemoEntry<T> {
  value: T;
  expiresAt: number;
  promise?: Promise<T>;
}

const MEMO_MAX_SIZE = 500;
const stores = new Map<string, Map<string, MemoEntry<unknown>>>();

function getStore(namespace: string): Map<string, MemoEntry<unknown>> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

/**
 * Memoize an async function by its argument tuple.
 *
 * Features:
 *   - TTL-based expiration
 *   - In-flight deduplication — concurrent callers with the same key
 *     all await the same promise instead of firing N requests
 *   - Bounded size (oldest-first eviction)
 *
 * @example
 *   const getTags = memoize(
 *     "popular-tags",
 *     async (limit: number) => pool.query(...),
 *     5 * 60_000 // 5 min TTL
 *   );
 *   const tags = await getTags(24); // hits PG
 *   const tags2 = await getTags(24); // hits memo cache
 */
export function memoize<Args extends readonly unknown[], T>(
  namespace: string,
  fn: (...args: Args) => Promise<T>,
  ttlMs: number
): (...args: Args) => Promise<T> {
  const store = getStore(namespace);

  return async (...args: Args): Promise<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const existing = store.get(key);

    if (existing) {
      // Fresh cache hit
      if (existing.expiresAt > now) {
        if (existing.promise) return existing.promise as Promise<T>;
        return existing.value as T;
      }
      // Expired — fall through to re-fetch
    }

    // Deduplicate in-flight requests
    const promise = fn(...args)
      .then((value) => {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .catch((err) => {
        store.delete(key);
        throw err;
      });

    // Stash the in-flight promise so concurrent callers get the same one
    store.set(key, {
      value: undefined as unknown as T,
      expiresAt: now + ttlMs,
      promise,
    });

    // Size cap — evict oldest entries
    if (store.size > MEMO_MAX_SIZE) {
      const toDelete = store.size - MEMO_MAX_SIZE;
      let i = 0;
      for (const k of store.keys()) {
        if (i++ >= toDelete) break;
        store.delete(k);
      }
    }

    return promise;
  };
}

/**
 * Periodically drop expired entries so the Map doesn't hold stale refs.
 * Runs every 5 minutes.
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const store of stores.values()) {
      for (const [key, entry] of store) {
        if (entry.expiresAt < now && !entry.promise) {
          store.delete(key);
        }
      }
    }
  }, 5 * 60 * 1000);
}
