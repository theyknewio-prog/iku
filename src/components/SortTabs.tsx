import Link from "next/link";
import {
  SORT_OPTIONS,
  parseSort as parseSortOption,
  type SortValue,
} from "@/lib/sort-options";

export type SortKey = SortValue;

interface Props {
  basePath: string;
  current: SortKey;
  extraQuery?: Record<string, string | undefined>;
}

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
    <nav className="sort-tabs" aria-label="Sort videos">
      {SORT_OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={buildHref(basePath, opt.value, defaultSort, extraQuery)}
          className={`filter-chip${current === opt.value ? " filter-chip--active" : ""}`}
          aria-current={current === opt.value ? "page" : undefined}
          prefetch={false}
        >
          {opt.label}
        </Link>
      ))}
    </nav>
  );
}

// Re-export so existing imports keep working.
export const parseSort = parseSortOption;
