import Link from "next/link";
import type { EntityMeta, EntityStat } from "@/lib/entity-seo";

/**
 * EntityStatsPanel — renders the first-party aggregate stats stored in
 * entity_seo.meta as a scannable "database" panel on tag/character/series
 * pages. This is the unique-to-iku data Google can't get from the source
 * sites (cross-source counts, 3D/2D split, top artists/co-tags) — it makes
 * the page a defensible data product instead of "scaled content", and every
 * chip is an internal link (maillage toward tags/characters/series).
 */

const fmt = (n?: number) => (n ?? 0).toLocaleString("en-US");

function StatChips({
  title,
  items,
  href,
}: {
  title: string;
  items: EntityStat[];
  href: (name: string) => string;
}) {
  const list = (items || []).filter((x) => x && x.name);
  if (list.length === 0) return null;
  return (
    <div style={{ marginTop: "14px" }}>
      <p
        style={{
          fontSize: "var(--text-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--color-text-tertiary)",
          margin: "0 0 8px",
        }}
      >
        {title}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {list.map((it) => (
          <Link
            key={it.name}
            href={href(it.name)}
            className="tag-pill tag-pill--dark"
            style={{ fontSize: "var(--text-sm)" }}
          >
            {it.label || it.name.replace(/_/g, " ")}
            <span className="tag-pill__count">{fmt(it.c)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EntityStatsPanel({
  meta,
  type,
}: {
  meta: EntityMeta;
  type: "tag" | "character" | "series";
}) {
  if (!meta || !meta.total) return null;

  const numbers = [
    { label: "Videos", value: fmt(meta.total) },
    meta.threeD ? { label: "3D / SFM", value: fmt(meta.threeD) } : null,
    meta.twoD ? { label: "2D", value: fmt(meta.twoD) } : null,
    meta.avgScore ? { label: "Avg score", value: fmt(meta.avgScore) } : null,
    meta.maxScore ? { label: "Top score", value: fmt(meta.maxScore) } : null,
    meta.recent30d ? { label: "New · 30d", value: fmt(meta.recent30d) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section
      aria-label="Catalogue stats"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg, 14px)",
        background: "var(--color-bg-elevated, rgba(255,255,255,0.02))",
        padding: "18px 20px",
        margin: "8px 0 24px",
        maxWidth: "760px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
          gap: "12px",
        }}
      >
        {numbers.map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontSize: "var(--text-xl, 1.5rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                color: "var(--color-text-primary)",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-tertiary)",
                marginTop: "2px",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <StatChips
        title="Top artists"
        items={meta.topArtists || []}
        href={(n) => `/tag/${encodeURIComponent(n)}`}
      />
      {type !== "series" && (
        <StatChips
          title="From series"
          items={meta.topCopyrights || []}
          href={(n) => `/series/${encodeURIComponent(n)}`}
        />
      )}
      {type === "series" && (
        <StatChips
          title="Top characters"
          items={meta.topCharacters || []}
          href={(n) => `/character/${encodeURIComponent(n)}`}
        />
      )}
      <StatChips
        title="Often tagged with"
        items={meta.topCoTags || []}
        href={(n) => `/tag/${encodeURIComponent(n)}`}
      />
    </section>
  );
}
