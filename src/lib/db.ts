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
    // Hard server-side cap — any query running over 10s is killed by PG.
    // Prevents a single runaway count/seq-scan from holding a pool slot
    // for 50s+ and blocking everything else. Also applied via ALTER SYSTEM
    // on the server, but setting it here means new deploys always carry it.
    statement_timeout: 10000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  // Belt-and-suspenders: also SET per session in case statement_timeout
  // param isn't honored by the pg driver version.
  pool.on("connect", (client) => {
    client.query("SET statement_timeout = '10s'").catch(() => {});
  });

  return pool;
}

export const pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export default pool;
