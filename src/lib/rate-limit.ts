/**
 * rate-limit.ts — bounded in-memory rate limiter, shared by all API routes.
 *
 * Usage:
 *
 *     const limiter = createRateLimiter({ name: "feed", max: 30, windowMs: 60_000 });
 *     // inside the handler:
 *     if (limiter.consume(getClientIp(request))) {
 *       return new Response("too many requests", { status: 429 });
 *     }
 *
 * Why a shared helper: 9 routes previously duplicated the same Map-based
 * pattern, with subtle variations — some had size caps, some didn't, cleanup
 * intervals differed, and the consume-then-check logic was written 9 different
 * ways. A single helper makes it impossible to accidentally introduce an
 * unbounded map or a TOCTOU race next time.
 *
 * Atomicity: the `consume` check is atomic in single-threaded Node (no `await`
 * between read and increment). Horizontal scaling would require a Redis-backed
 * version — today we're on a single container, so this is fine.
 */

export interface RateLimitOptions {
  /** Human-readable name for logging (e.g. "feed", "checkout"). */
  name: string;
  /** Maximum requests allowed inside one window. */
  max: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /**
   * Maximum number of keys (unique IPs/users) to track. Defaults to 10k.
   * Hard cap — oldest entries are dropped when the cap is exceeded.
   */
  maxKeys?: number;
  /**
   * Cleanup interval in milliseconds. Defaults to 5 minutes.
   * Prunes expired entries so memory stays flat under steady-state load.
   */
  cleanupIntervalMs?: number;
}

export interface RateLimiter {
  /**
   * Record an attempt against `key`. Returns `true` if the request should be
   * rejected (over quota), `false` if it may proceed.
   */
  consume(key: string): boolean;
  /**
   * Current number of tracked keys — useful for health endpoints.
   */
  size(): number;
}

/**
 * Create a rate limiter. Call once at module scope, then invoke `consume`
 * inside each request handler. Do NOT create a new limiter per request.
 */
export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  const { name, max, windowMs, maxKeys = 10_000, cleanupIntervalMs = 5 * 60_000 } = opts;
  const store = new Map<string, { count: number; resetAt: number }>();

  // Periodic cleanup — drops expired entries and enforces the hard cap.
  // setInterval with unref() so the timer doesn't keep the process alive.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store) {
      if (now > val.resetAt) store.delete(key);
    }
    // Hard cap: if cleanup didn't shrink enough, drop oldest entries.
    // Map iteration order is insertion order, so .keys().next() is the oldest.
    while (store.size > maxKeys) {
      const first = store.keys().next().value;
      if (first === undefined) break;
      store.delete(first);
    }
  }, cleanupIntervalMs);
  // unref() is Node-only — guard for edge runtime.
  if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
    (timer as unknown as { unref: () => void }).unref();
  }

  return {
    consume(key: string): boolean {
      const now = Date.now();
      const entry = store.get(key);
      if (entry && now < entry.resetAt) {
        if (entry.count >= max) {
          return true; // reject
        }
        entry.count++;
        return false;
      }
      // New window (or first hit).
      store.set(key, { count: 1, resetAt: now + windowMs });
      // Debug-only: warn if we're about to blow the cap (caught sooner than
      // the periodic cleanup would).
      if (store.size > maxKeys * 1.1) {
        console.warn(`[rate-limit:${name}] store size ${store.size} > cap ${maxKeys}`);
      }
      return false;
    },
    size(): number {
      return store.size;
    },
  };
}

/**
 * Extract the client IP from a request, preferring Traefik's `x-real-ip`
 * header (non-spoofable) and falling back to the last entry of
 * `x-forwarded-for` (also non-spoofable — the last hop is the one closest
 * to our reverse proxy).
 *
 * NEVER use `x-forwarded-for[0]` — the first entry is user-controllable.
 */
export function getClientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "unknown";
}
