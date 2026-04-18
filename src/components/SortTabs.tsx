import Link from "next/link";

export type SortKey = "score" | "date" | "duration" | "favcount";

interface Props {
  basePath: string;
  current: SortKey;
  extraQuery?: Record<string, string | undefined>;
}

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Most popular" },
  { value: "date", label: "Newest" },
  { value: "duration", label: "Longest" },
  { value: "favcount", label: "Most liked" },
];

function buildHref(
  basePath: string,
  s: SortKey,
  def: SortKey,
  extra?: Props["extraQuery"],
): string {
  const params = new URLSearchParams();
  if (s !== def) params.set("sort", s);
  if (extra) {
    for (const [k, val] of Object.entries(extra)) {
      if (val) params.set(k, val);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function SortTabs({
  basePath,
  current,
  extraQuery,
  defaultSort = "score",
}: Props & { defaultSort?: SortKey }) {
  return (
    <nav
      className="sort-tabs"
      aria-label="Sort videos"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        margin: "0 0 20px",
        overflowX: "auto",
      }}
    >
      {OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={buildHref(basePath, opt.value, defaultSort, extraQuery)}
          className={`filter-chip${current === opt.value ? " filter-chip--active" : ""}`}
          prefetch={false}
        >
          {opt.label}
        </Link>
      ))}
    </nav>
  );
}

export function parseSort(
  raw: string | string[] | undefined,
  fallback: SortKey = "score",
): SortKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "score" || v === "date" || v === "duration" || v === "favcount")
    return v;
  return fallback;
}
