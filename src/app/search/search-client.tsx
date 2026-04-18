"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";

/**
 * Wrapper that focuses the SearchAutocomplete input on mount. Used by the
 * dedicated /search page so mobile users who tap "Search" in the bottom nav
 * immediately get a keyboard instead of landing on /explore with no input
 * in focus. Also reads ?q= from the URL so shared search links prefill the
 * input instead of showing an empty state.
 */
export function SearchClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    const input = containerRef.current?.querySelector(
      "input",
    ) as HTMLInputElement | null;
    input?.focus();
  }, []);

  return (
    <div ref={containerRef} style={{ maxWidth: 640, margin: "24px auto 0" }}>
      <SearchAutocomplete initialQuery={initialQuery} />
      <p
        style={{
          marginTop: 16,
          textAlign: "center",
          color: "var(--color-text-tertiary)",
          fontSize: "var(--text-xs)",
        }}
      >
        Try searching: <em>hatsune miku</em>, <em>school uniform</em>,{" "}
        <em>fate</em>, <em>demon girl</em>
      </p>
    </div>
  );
}
