/**
 * db.ts — PostgreSQL connection pool (singleton)
 *
 * Uses a global variable to survive Next.js hot reloads in dev mode.
 * In production, a single pool is shared across all requests.
 */

import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Raised from 20 to 50 — previously we hit ~47k connection timeouts
    // per container lifetime because a single watch page render fires
    // 4+ PG queries (getVideos, getRelatedVideos x2, metadata, thumbnails)
    // and 20 slots saturate instantly under real traffic.
    // PostgreSQL 16 default max_connections is 100, so 50 leaves plenty
    // of headroom for cron scripts + scrapers.
    max: 50,
    idleTimeoutMillis: 30000,
    // Raised from 5s to 10s — under burst load the queue can back up
    // legitimately for a few seconds, and a 5s timeout was throwing
    // before connections could be released.
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  return pool;
}

export const pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export default pool;
