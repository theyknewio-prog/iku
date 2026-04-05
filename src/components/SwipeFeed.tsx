"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { VideoCard } from "./VideoCard";

export interface FeedVideo {
  id: number;
  slug?: string;
  videoUrl: string;
  thumbnail: string;
  score: number;
  tags: string[];
  character: string;
  artist: string;
  copyright: string;
  width: number;
  height: number;
  size: number;
}

export function SwipeFeed() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  // Captured from the first API response and forwarded on all subsequent fetches.
  const sessionOffsetRef = useRef<number | null>(null);

  const fetchVideos = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const offsetParam =
        sessionOffsetRef.current !== null
          ? `&offset=${sessionOffsetRef.current}`
          : "";
      const res = await fetch(`/api/feed?page=${pageNum}${offsetParam}`);
      const data = await res.json();

      // Store the offset from the first response for all future pages.
      if (sessionOffsetRef.current === null && typeof data.offset === "number") {
        sessionOffsetRef.current = data.offset;
      }

      if (data.videos && data.videos.length > 0) {
        setVideos((prev) => [...prev, ...data.videos]);
      }

      // Always advance the cursor, even on empty pages, so that subsequent
      // triggers try the *next* page rather than retrying the same one forever.
      // The API response may return fewer (or zero) rows after the URL/size
      // filters — without this we could get stuck retrying page N indefinitely.
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchVideos(1);
  }, [fetchVideos]);

  // Safety net: if a fetch returned few videos (aggressive server-side filtering
  // can drop most of a batch), the IntersectionObserver may not fire again
  // because the active card is already past the new threshold. Re-check after
  // every state change and proactively refetch the next page while the buffer
  // ahead of the active index is dangerously low.
  useEffect(() => {
    if (loadingRef.current) return;
    if (videos.length === 0) return;
    const buffer = videos.length - activeIndex;
    if (buffer < 5) {
      fetchVideos(page + 1);
    }
  }, [videos.length, activeIndex, page, fetchVideos]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) {
              setActiveIndex(index);
              if (index >= videos.length - 5) {
                fetchVideos(page + 1);
              }
            }
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    const items = container.querySelectorAll(".feed-item");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [videos.length, page, fetchVideos]);

  if (loading && videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-dvh bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="loader" />
          <p className="text-[#888] text-sm">loading iku...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Fixed close button — top-left, above everything */}
      <Link
        href="/"
        className="feed-close-btn"
        aria-label="Close feed and go back"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </Link>

      <div ref={containerRef} className="feed-container">
        {videos.map((video, index) => (
          <VideoCard
            key={`${video.id}-${index}`}
            video={video}
            index={index}
            isActive={index === activeIndex}
            preloadNext={index > activeIndex && index <= activeIndex + 2}
          />
        ))}
      </div>
    </div>
  );
}
