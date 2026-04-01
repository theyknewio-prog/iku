"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VideoCard } from "./VideoCard";

interface VideoItem {
  id: string;
  title: string;
  embedUrl: string;
  thumbnail: string;
  duration: string;
  views: string;
  tags: string[];
  source: string;
}

export function SwipeFeed() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(0);
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

      if (data.videos.length > 0) {
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

  // Initial load
  useEffect(() => {
    fetchVideos(0);
  }, [fetchVideos]);

  // Intersection observer for active video detection + infinite scroll
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

              // Load more when near the end
              if (index >= videos.length - 4) {
                fetchVideos(page + 1);
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.7,
      }
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
          <span className="text-text-secondary text-sm">loading iku...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="feed-container">
      {videos.map((video, index) => (
        <VideoCard
          key={video.id}
          video={video}
          index={index}
          isActive={index === activeIndex}
        />
      ))}

      {/* Load more trigger */}
      {videos.length > 0 && (
        <div className="feed-item flex items-center justify-center">
          <div className="loader" />
        </div>
      )}
    </div>
  );
}
