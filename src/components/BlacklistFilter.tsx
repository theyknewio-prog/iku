"use client";

import { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";
import { ThumbnailCard } from "./ThumbnailCard";

/**
 * Client wrapper that renders a video grid with blacklist filtering.
 * SSR renders all videos; client removes blacklisted ones after hydration.
 */
export function BlacklistFilter({ videos }: { videos: Video[] }) {
  const [filtered, setFiltered] = useState<Video[]>(videos);

  useEffect(() => {
    setFiltered(filterByBlacklist(videos));
  }, [videos]);

  return (
    <div className="video-grid">
      {filtered.map((video, i) => (
        <ThumbnailCard
          key={video.id}
          video={video}
          priority={i < 4}
          lazy={i >= 4}
        />
      ))}
    </div>
  );
}
