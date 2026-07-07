"use client";

import { useState, useEffect, Fragment, type ReactNode } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";
import { ThumbnailCard } from "./ThumbnailCard";

/**
 * Client wrapper that renders a video grid with blacklist filtering.
 * SSR renders all videos; client removes blacklisted ones after hydration.
 *
 * `interleave` lets server pages weave ad nodes (NativeOfferCard,
 * GridAdBreak…) into the grid: each node renders BEFORE the card at
 * `index`. Indices are computed on the FILTERED list, so ads keep their
 * spacing even when the user blacklists tags (they shift up with the
 * cards, never disappear).
 */
export function BlacklistFilter({
  videos,
  interleave,
}: {
  videos: Video[];
  interleave?: { index: number; node: ReactNode }[];
}) {
  const [filtered, setFiltered] = useState<Video[]>(videos);

  useEffect(() => {
    setFiltered(filterByBlacklist(videos));
  }, [videos]);

  return (
    <div className="video-grid">
      {filtered.map((video, i) => (
        <Fragment key={video.id}>
          {interleave
            ?.filter((a) => a.index === i)
            .map((a) => (
              <Fragment key={`ad-${a.index}`}>{a.node}</Fragment>
            ))}
          <ThumbnailCard video={video} priority={i < 4} lazy={i >= 4} />
        </Fragment>
      ))}
    </div>
  );
}
