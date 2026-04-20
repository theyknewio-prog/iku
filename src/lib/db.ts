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
    // 35 slots — lowered from 50 after 2026-04-17 PG meltdown.
    // PG only has 4 vCPUs: pushing 50 parallel queries means they pile up on
    // BufferMapping locks instead of parallelizing, which drags every query
    // into 10s+ land. 35 saturates a bit slower and queues the rest in Node.
    max: 35,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Hard server-side cap — any query over 3s is killed by PG. Was 10s but
    // a 10s runaway holds a pool slot long enough to cascade pool exhaustion.
    // 3s is well above our p99 (~350ms) and kills plan regressions fast.
    // Use `queryWithTimeout(ms, ...)` below for rare queries that legitimately
    // need more (e.g. bulk upserts from scrapers).
    statement_timeout: 3000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  pool.on("connect", (client) => {
    client.query("SET statement_timeout = '3s'").catch(() => {});
  });

  return pool;
}

export const pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

/**
 * Run a query with a custom statement_timeout (in ms). Acquires a dedicated
 * client, sets the timeout, runs the query, resets, releases. Use sparingly
 * — the default 3s already covers 99% of the code paths.
 *
 * Intended use cases:
 *   - Scraper ingest (COPY, bulk UPSERT)       → 30000
 *   - Admin/analytics queries                  → 15000
 *   - Cold-cache count(*)                      → 10000
 */
export async function queryWithTimeout<R extends Record<string, unknown>>(
  timeoutMs: number,
  sql: string,
  params?: unknown[],
): Promise<{ rows: R[]; rowCount: number | null }> {
  const client = await pool.connect();
  try {
    await client.query(
      `SET statement_timeout = ${Math.max(100, timeoutMs | 0)}`,
    );
    const result = await client.query<R>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount };
  } finally {
    try {
      await client.query("SET statement_timeout = '3s'");
    } catch {
      // swallow — the client is about to be returned to the pool anyway
    }
    client.release();
  }
}

export default pool;
