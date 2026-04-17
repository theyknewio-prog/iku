/**
 * memo.ts — TTL memoization with stale-while-revalidate for expensive async calls.
 *
 * Used to cache PG query results (popular tags, popular characters, etc.)
 * at the application layer. Complements Next.js ISR — ISR caches the
 * rendered HTML, this caches the raw data so that SSR on a cold route
 * still completes in <50ms instead of hitting PG multiple times.
 *
 * Behavior (2026-04-17 — hardened after a PG meltdown):
 *   - Fresh hit: return value immediately
 *   - Expired + had value: return stale value, fire background refresh
 *   - Expired + cold: await first fetch
 *   - Concurrent callers: dedupe to a single in-flight promise
 *   - Refresh error + had value: keep serving stale, retry in 30s (backoff)
 *   - Refresh error + cold: delete key so next call can retry
 *
 * This prevents the thundering herd pattern where a single PG timeout
 * poisons the cache, forcing every subsequent request to fire a fresh
 * query (which ALSO times out, pinning every pool connection).
 */

interface MemoEntry<T> {
  value: T;
  hasValue: boolean;
  expiresAt: number;
  promise?: Promise<T>;
}

const MEMO_MAX_SIZE = 500;
const ERROR_BACKOFF_MS = 30_000;
const stores = new Map<string, Map<string, MemoEntry<unknown>>>();

function getStore(namespace: string): Map<string, MemoEntry<unknown>> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export function memoize<Args extends readonly unknown[], T>(
  namespace: string,
  fn: (...args: Args) => Promise<T>,
  ttlMs: number,
): (...args: Args) => Promise<T> {
  const store = getStore(namespace) as Map<string, MemoEntry<T>>;

  return async (...args: Args): Promise<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const existing = store.get(key);

    // Fresh hit — return cached value or in-flight promise
    if (existing && existing.expiresAt > now) {
      if (existing.hasValue) return existing.value;
      if (existing.promise) return existing.promise;
    }

    // Expired + refresh already in flight + has stale value → serve stale
    if (existing?.promise && existing.hasValue) {
      return existing.value;
    }

    // Need a fresh fetch
    const promise = fn(...args)
      .then((value) => {
        store.set(key, {
          value,
          hasValue: true,
          expiresAt: Date.now() + ttlMs,
        });
        return value;
      })
      .catch((err) => {
        const prev = store.get(key);
        if (prev?.hasValue) {
          store.set(key, {
            value: prev.value,
            hasValue: true,
            expiresAt: Date.now() + ERROR_BACKOFF_MS,
          });
        } else {
          store.delete(key);
        }
        throw err;
      });

    if (existing?.hasValue) {
      // Stale-while-revalidate: stash the refresh promise alongside the old value
      store.set(key, {
        value: existing.value,
        hasValue: true,
        expiresAt: existing.expiresAt,
        promise,
      });
      return existing.value;
    }

    // Cold cache — await the fetch
    store.set(key, {
      value: undefined as unknown as T,
      hasValue: false,
      expiresAt: now + ttlMs,
      promise,
    });

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

if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const store of stores.values()) {
        for (const [key, entry] of store) {
          if (entry.expiresAt < now && !entry.promise && !entry.hasValue) {
            store.delete(key);
          }
        }
      }
    },
    5 * 60 * 1000,
  );
}
