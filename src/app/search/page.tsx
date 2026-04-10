import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Search Hentai Videos | iku.gg",
  description:
    "Search thousands of free animated hentai videos on iku.gg by character, tag, or series.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-static";

export default function SearchPage() {
  return (
    <main className="shell-content">
      <div
        className="page-container"
        style={{ paddingTop: "32px", paddingBottom: "80px" }}
      >
        <div className="tag-hero">
          <p className="tag-hero__label">Search</p>
          <h1 className="tag-hero__title">Find Hentai Videos</h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              marginTop: 6,
            }}
          >
            Type a character, tag, or series to find matching videos.
          </p>
        </div>
        <Suspense fallback={null}>
          <SearchClient />
        </Suspense>
      </div>
    </main>
  );
}
