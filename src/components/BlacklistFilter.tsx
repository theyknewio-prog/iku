"use client";

import React, { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";
import { ThumbnailCard } from "./ThumbnailCard";
import { NativeAdCard } from "./NativeAdCard";

/**
 * Client wrapper that renders a video grid with blacklist filtering.
 * SSR renders all videos; client removes blacklisted ones after hydration.
 *
 * Native ad injected every 12 cards — desktop-only via CSS
 * (.native-ad-card is display:none under 768px viewport).
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
          <ThumbnailCard video={video} priority={i < 4} lazy={i >= 4} />
          {(i + 1) % 12 === 0 && i < filtered.length - 1 && <NativeAdCard />}
        </React.Fragment>
      ))}
    </div>
  );
}
