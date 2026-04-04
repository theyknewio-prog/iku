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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
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
