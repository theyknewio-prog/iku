"use client";

import React from "react";
import { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";
import { ThumbnailCard } from "./ThumbnailCard";
import { NativeAdCard } from "./NativeAdCard";

/**
 * Client wrapper that renders a video grid with blacklist filtering.
 * SSR renders all videos; client removes blacklisted ones after hydration.
 * Native ad cards are inserted every 8 positions.
 */
export function BlacklistFilter({ videos }: { videos: Video[] }) {
  const [filtered, setFiltered] = useState<Video[]>(videos);

  useEffect(() => {
    setFiltered(filterByBlacklist(videos));
  }, [videos]);

  return (
    <div className="video-grid">
      {filtered.map((video, i) => (
        <React.Fragment key={video.id}>
          {i > 0 && i % 8 === 0 && <NativeAdCard />}
          <ThumbnailCard
            video={video}
            priority={i < 4}
            lazy={i >= 4}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
