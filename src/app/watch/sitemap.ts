import type { MetadataRoute } from "next";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = "https://iku.gg";
const MAX_PER_SITEMAP = 45000;

export async function generateSitemaps() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) as total FROM videos");
    const total = parseInt(rows[0].total, 10);
    const count = Math.ceil(total / MAX_PER_SITEMAP);
    return Array.from({ length: count }, (_, i) => ({ id: i }));
  } catch {
    // During build, PG may not be available — return a single sitemap placeholder
    return [{ id: 0 }];
  }
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = parseInt(idStr, 10);
  const offset = id * MAX_PER_SITEMAP;

  let rows: Array<{ slug: string; created_at: string }> = [];
  try {
    const result = await pool.query(
      "SELECT slug, created_at FROM videos ORDER BY pk LIMIT $1 OFFSET $2",
      [MAX_PER_SITEMAP, offset],
    );
    rows = result.rows;
  } catch {
    // PG unavailable during build — return empty sitemap
    return [];
  }

  return rows.map((row) => ({
    url: `${SITE}/watch/${row.slug}`,
    lastModified: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
