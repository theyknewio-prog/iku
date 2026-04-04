"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Types ─────────────────────────────────────────────────── */

interface DanbooruTag {
  name: string;
  post_count: number;
  category: number; // 0=general 1=artist 3=copyright 4=character
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function categoryColor(category: number): string {
  switch (category) {
    case 4: return "#22c55e";   // character → green
    case 3: return "#a855f7";   // copyright → purple
    case 1: return "#ec4899";   // artist    → pink
    default: return "#6b7280";  // general   → gray
  }
}

function categoryLabel(category: number): string {
  switch (category) {
    case 4: return "character";
    case 3: return "copyright";
    case 1: return "artist";
    default: return "general";
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ── SVG Icons ──────────────────────────────────────────────── */

function IconSearch({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ── Component ──────────────────────────────────────────────── */

export function SearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DanbooruTag[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  /* Fetch suggestions */
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    const url =
      `https://danbooru.donmai.us/tags.json` +
      `?search[name_matches]=*${encodeURIComponent(debouncedQuery)}*` +
      `&search[order]=count&limit=10`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: DanbooruTag[]) => {
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        // aborted or network error — silently ignore
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  /* Click outside → close */
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  /* Navigate to tag */
  const goToTag = useCallback(
    (tagName: string) => {
      const encoded = encodeURIComponent(tagName.replace(/\s+/g, "_"));
      setOpen(false);
      setQuery("");
      router.push(`/tag/${encoded}`);
    },
    [router]
  );

  /* Form submit — navigate to typed text */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().replace(/\s+/g, "_");
    if (q) goToTag(q);
  }

  /* Keyboard navigation */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToTag(suggestions[activeIndex].name);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="search-autocomplete">
      <form
        className="v2-topbar__search"
        onSubmit={handleSubmit}
        role="search"
        autoComplete="off"
      >
        <span className="v2-topbar__search-icon" aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          type="search"
          className="v2-topbar__search-input"
          placeholder="Search characters, series, tags..."
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? "search-suggestions" : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
        {loading && <span className="search-autocomplete__spinner" aria-hidden="true" />}
      </form>

      {showDropdown && (
        <ul
          id="search-suggestions"
          className="search-autocomplete__dropdown"
          role="listbox"
          aria-label="Tag suggestions"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag.name}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`search-autocomplete__item${i === activeIndex ? " search-autocomplete__item--active" : ""}`}
              onPointerDown={(e) => {
                // pointerdown fires before blur so we can navigate before input loses focus
                e.preventDefault();
                goToTag(tag.name);
              }}
            >
              <span
                className="search-autocomplete__dot"
                style={{ background: categoryColor(tag.category) }}
                title={categoryLabel(tag.category)}
              />
              <span className="search-autocomplete__name">
                {tag.name.replace(/_/g, " ")}
              </span>
              <span className="search-autocomplete__count">
                {formatCount(tag.post_count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
