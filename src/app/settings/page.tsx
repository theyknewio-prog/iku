"use client";

import { useState, useEffect, useRef } from "react";
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
} from "@/lib/blacklist";

const QUICK_ADD_TAGS = ["ugly_bastard", "ntr", "guro", "scat", "vore", "furry"];

export default function SettingsPage() {
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBlacklist(getBlacklist());
    setMounted(true);
  }, []);

  function handleAdd(tag: string) {
    const normalised = tag.trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalised || blacklist.includes(normalised)) return;
    addToBlacklist(normalised);
    setBlacklist(getBlacklist());
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(tag: string) {
    removeFromBlacklist(tag);
    setBlacklist(getBlacklist());
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = inputRef.current?.value ?? "";
    handleAdd(val);
  }

  if (!mounted) {
    return (
      <main className="shell-content">
        <div className="page-container" style={{ paddingTop: "48px" }}>
          <div className="explore-header">
            <h1 className="explore-header__title">Settings</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell-content">
      <div
        className="page-container"
        style={{ paddingTop: "48px", paddingBottom: "80px", maxWidth: "640px" }}
      >
        <div className="explore-header" style={{ marginBottom: "32px" }}>
          <h1 className="explore-header__title">Settings</h1>
          <p className="explore-header__sub">Personalise your experience</p>
        </div>

        {/* ── Blocked Tags ─────────────────────────────────────── */}
        <section style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "var(--text-md)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "8px",
            }}
          >
            Blocked Tags
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              marginBottom: "20px",
              lineHeight: 1.6,
            }}
          >
            Videos containing these tags will be hidden across the entire site.
            Changes take effect immediately on next page load.
          </p>

          {/* Quick-add pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {QUICK_ADD_TAGS.map((tag) => {
              const blocked = blacklist.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => (blocked ? handleRemove(tag) : handleAdd(tag))}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    cursor: "pointer",
                    border: blocked
                      ? "1px solid var(--color-error)"
                      : "1px solid var(--color-border-default)",
                    background: blocked
                      ? "rgba(239,68,68,0.12)"
                      : "var(--color-bg-muted)",
                    color: blocked
                      ? "var(--color-error)"
                      : "var(--color-text-secondary)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {blocked ? "✓ " : "+ "}
                  {tag.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>

          {/* Custom tag input */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "8px", marginBottom: "24px" }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a tag (e.g. netorare)"
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "var(--color-bg-muted)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "8px",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  "var(--color-border-default)";
              }}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: "nowrap" }}
            >
              Block Tag
            </button>
          </form>

          {/* Current blocked tags list */}
          {blacklist.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-tertiary)",
                fontStyle: "italic",
              }}
            >
              No tags blocked yet.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {blacklist.map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--color-bg-muted)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => handleRemove(tag)}
                    aria-label={`Unblock ${tag}`}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-text-tertiary)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "var(--text-base)",
                      lineHeight: 1,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--color-error)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color =
                        "var(--color-text-tertiary)";
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── About ────────────────────────────────────────────── */}
        <section
          style={{
            padding: "16px 20px",
            background: "var(--color-bg-muted)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              lineHeight: 1.7,
            }}
          >
            All preferences are stored locally in your browser. No account
            required. Your data never leaves your device.
          </p>
        </section>
      </div>
    </main>
  );
}
