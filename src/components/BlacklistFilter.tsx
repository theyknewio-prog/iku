"use client";

import React, { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";
import { ThumbnailCard } from "./ThumbnailCard";
import { NativeAdCard } from "./NativeAdCard";
import { HentaiProsBanner } from "./HentaiProsBanner";

/**
 * Client wrapper that renders a video grid with blacklist filtering.
 * SSR renders all videos; client removes blacklisted ones after hydration.
 *
 * Every 6 cards we inject an ad slot. NativeAdCard is hidden under 768px
 * via CSS, so on mobile (90% of traffic) we render a guaranteed-fill
 * HentaiPros 300x250 in its place. Both occupy the same grid position so
 * card cadence is identical across viewports.
 *
 * Ship #6 2026-04-20: cadence tightened from every 12 → every 6 cards to
 * match Hentaigasm/HentaiCity density (top earners inject natives every
 * 4-6 cards). At a 24-card listing we go from 1 ad → 3 ads = +200% inventory
 * on the dominant page-view surface (/tag /character /series /explore).
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
          {(i + 1) % 6 === 0 && i < filtered.length - 1 && (
            <>
              <NativeAdCard />
              <div className="grid-ad-mobile">
                <HentaiProsBanner format="300x250" mobileFormat="300x250" />
              </div>
            </>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
