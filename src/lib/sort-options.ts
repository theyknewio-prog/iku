/**
 * Canonical sort options for listing pages.
 *
 * Single source of truth for the sort tab set used on /explore, /trending,
 * /new, /hentai, /3d, /episodes, /tag/[tag], /character/[slug], /series/[slug].
 *
 * Adding "duration-asc" (Shortest) excludes null/zero durations via the
 * content.ts query builder — otherwise unresolved videos would dominate the top.
 */
export const SORT_OPTIONS = [
  { value: "score", label: "Top Rated" },
  { value: "date", label: "Newest" },
  { value: "duration", label: "Longest" },
  { value: "duration-asc", label: "Shortest" },
  { value: "favcount", label: "Most Saved" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Safely coerce a raw search-param value to a SortValue. */
export function parseSort(
  input: string | string[] | undefined,
  fallback: SortValue = "score",
): SortValue {
  const v = Array.isArray(input) ? input[0] : input;
  if (!v) return fallback;
  return (SORT_OPTIONS.some((o) => o.value === v) ? v : fallback) as SortValue;
}
