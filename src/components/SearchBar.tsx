"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const POPULAR_TAGS = [
  "animated", "solo", "outdoors", "fantasy", "original",
  "school_uniform", "bunny_girl", "maid", "elf", "demon_girl",
];

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search characters, tags, artists…",
  onSearch,
}: SearchBarProps) {
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [value,  setValue]  = useState(defaultValue);
  const [focused, setFocused] = useState(false);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (q: string) => {
    if (!q.trim()) return;
    setFocused(false);
    if (onSearch) {
      onSearch(q.trim());
    } else {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit(value);
    if (e.key === "Escape") setFocused(false);
  };

  const showDropdown = focused;

  return (
    <div ref={wrapRef} className="search-bar" style={{ position: "relative" }}>
      {/* Search icon */}
      <span className="search-bar__icon" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>

      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="search-bar__input"
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />

      {/* Search button */}
      {value && (
        <button
          type="button"
          className="search-bar__submit"
          onClick={() => submit(value)}
          aria-label="Search"
        >
          Search
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-dropdown" role="listbox" aria-label="Suggestions">
          {value.trim().length > 0 ? (
            /* Live query suggestions */
            <div className="search-dropdown__section">
              <div className="search-dropdown__label">Tags</div>
              {POPULAR_TAGS.filter((t) =>
                t.toLowerCase().includes(value.toLowerCase())
              )
                .slice(0, 5)
                .map((tag) => (
                  <button
                    key={tag}
                    role="option"
                    className="search-dropdown__item"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                    onMouseDown={() => {
                      setValue(tag);
                      submit(tag);
                    }}
                  >
                    <span className="search-dropdown__item-icon">#</span>
                    <span>{tag.replace(/_/g, " ")}</span>
                  </button>
                ))}
            </div>
          ) : (
            /* Empty state — trending + recent */
            <>
              <div className="search-dropdown__section">
                <div className="search-dropdown__label">Popular tags</div>
                {POPULAR_TAGS.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    role="option"
                    className="search-dropdown__item"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                    onMouseDown={() => {
                      setValue(tag);
                      submit(tag);
                    }}
                  >
                    <span className="search-dropdown__item-icon">
                      {/* trending icon */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                    </span>
                    <span>{tag.replace(/_/g, " ")}</span>
                    <span className="search-dropdown__meta">trending</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
