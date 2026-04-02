"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { VideoCard } from "./VideoCard";

export interface FeedVideo {
  id: number;
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

  const fetchVideos = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const res = await fetch(`/api/feed?page=${pageNum}`);
      const data = await res.json();

      if (data.videos && data.videos.length > 0) {
        setVideos((prev) => [...prev, ...data.videos]);
        setPage(pageNum);
      }
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
          />
        ))}
      </div>
    </div>
  );
}
