"use client";

import { useState, useEffect } from "react";
import type { Video } from "@/types/video";
import { filterByBlacklist } from "@/lib/blacklist";

interface BlacklistFilterProps {
  videos: Video[];
  children: (filtered: Video[]) => React.ReactNode;
}

/**
 * Thin client wrapper that runs the blacklist filter after hydration.
 * SSR renders all videos; client removes blacklisted ones.
 */
export function BlacklistFilter({ videos, children }: BlacklistFilterProps) {
  const [filtered, setFiltered] = useState<Video[]>(videos);

  useEffect(() => {
    setFiltered(filterByBlacklist(videos));
  }, [videos]);

  return <>{children(filtered)}</>;
}
