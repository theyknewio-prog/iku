"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { VideoCard } from "./VideoCard";
import { FeedConversionCTA } from "./FeedConversionCTA";
import { useSession } from "next-auth/react";

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
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  // Global mute state — shared across all cards. Once the user unmutes,
  // all subsequent videos play with sound (like TikTok/RedGIFs).
  const [globalMuted, setGlobalMuted] = useState(true);
  // Interstitial ad tracking
  const [showInterstitial, setShowInterstitial] = useState(false);
  const interstitialCountRef = useRef(0);
  const lastInterstitialIndexRef = useRef(-10);
  const isPro = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  // Keyset cursor forwarded on each subsequent request. null = first request
  // (server picks session sort + random offset). false = end of feed reached.
  const cursorRef = useRef<string | null>(null);

  const fetchVideos = useCallback(async () => {
    if (loadingRef.current) return;
    if (cursorRef.current === null && videos.length > 0) return; // first fetch already done
    loadingRef.current = true;

    try {
      const cursorParam =
        cursorRef.current && videos.length > 0
          ? `?cursor=${encodeURIComponent(cursorRef.current)}`
          : "";
      const res = await fetch(`/api/feed${cursorParam}`);
      if (!res.ok) {
        // Transient error — leave cursor untouched so a retry hits the same
        // slice again instead of skipping ahead. Stop trying after 3 failures.
        console.error("feed fetch failed:", res.status);
        return;
      }
      const data = await res.json();

      if (data.videos && data.videos.length > 0) {
        setVideos((prev) => [...prev, ...data.videos]);
      }

      // Update cursor for the next fetch. `null` means the server returned
      // no more pages — stop the infinite loop gracefully.
      if (typeof data.cursor === "string") {
        cursorRef.current = data.cursor;
      } else {
        cursorRef.current = null;
        setExhausted(true);
      }

      if (!data.hasMore) setExhausted(true);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [videos.length]);

  // First fetch on mount
  useEffect(() => {
    if (videos.length === 0 && !loadingRef.current) {
      fetchVideos();
    }
    // Run once — fetchVideos rebinds when videos.length changes but we don't
    // want to re-fire the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety net: proactively prefetch the next keyset page while the buffer
  // ahead of the active card is dangerously low. Guarded by `exhausted` so
  // we stop hitting the API once the server confirmed end of feed.
  useEffect(() => {
    if (loadingRef.current || exhausted) return;
    if (videos.length === 0) return;
    const buffer = videos.length - activeIndex;
    if (buffer < 5) {
      fetchVideos();
    }
  }, [videos.length, activeIndex, exhausted, fetchVideos]);

  // Detect Pro user. UserDataSync populates document.body.dataset.pro
  // asynchronously after /api/profile returns, so the initial mount read
  // is always false. Observe the attribute to stay in sync.
  useEffect(() => {
    const read = () => {
      isPro.current = document.body.dataset.pro === "1";
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-pro"],
    });
    // Restore interstitial count from sessionStorage
    try {
      const stored = sessionStorage.getItem("iku-interstitial-count");
      if (stored) interstitialCountRef.current = parseInt(stored) || 0;
    } catch {
      /* private browsing */
    }
    return () => observer.disconnect();
  }, []);

  /* Broken-card handler — called by VideoCard when its <video> errors or
   * fails to reach a playable state within 4s. We remove the dead card from
   * the feed array so the next card immediately snaps into view. Without
   * this, users hit dead black-screen cards (stale IP-bound tokens, broken
   * CDN routes, etc.) and have to manually swipe past them.
   *
   * If the broken card is the currently-active one, we splice it out; the
   * IntersectionObserver + CSS scroll-snap will resync on the next
   * scrollable item. */
  const handleBrokenCard = useCallback((brokenIndex: number) => {
    setVideos((prev) => {
      // Splice the broken card out. React re-renders with indices shifted
      // down by one; activeIndex stays the same numerical value so the next
      // card takes the dead slot and starts playing automatically.
      if (brokenIndex < 0 || brokenIndex >= prev.length) return prev;
      return [...prev.slice(0, brokenIndex), ...prev.slice(brokenIndex + 1)];
    });
  }, []);

  // Conversion CTA every 12 swipes — tightened from /15 alongside the VAST
  // /10 → /7 (Ship #10). Still offset from the VAST cadence so the two
  // never collide on the same swipe (LCM(7,12) = 84 — collisions only
  // every 84 swipes, well past typical session length).
  useEffect(() => {
    if (
      activeIndex > 0 &&
      activeIndex % 12 === 0 &&
      activeIndex !== lastInterstitialIndexRef.current &&
      !isPro.current
    ) {
      lastInterstitialIndexRef.current = activeIndex;
      setShowInterstitial(true);
      interstitialCountRef.current += 1;
      try {
        sessionStorage.setItem(
          "iku-interstitial-count",
          String(interstitialCountRef.current),
        );
      } catch {
        /* quota */
      }
    }
  }, [activeIndex]);

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
              if (index >= videos.length - 5 && !exhausted) {
                fetchVideos();
              }
            }
          }
        });
      },
      { root: container, threshold: 0.6 },
    );

    const items = container.querySelectorAll(".feed-item");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [videos.length, exhausted, fetchVideos]);

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
      {/* Conversion CTA — alternates signup ↔ premium based on count
          and login state. Anon users see signup first; logged-in non-Pro
          users always see premium. */}
      {showInterstitial && (
        <FeedConversionCTA
          variant={
            // Logged-in users only see premium pushes (signup is moot for them).
            // Anon users alternate signup → premium → signup → ...
            isLoggedIn || interstitialCountRef.current % 2 === 0
              ? "premium"
              : "signup"
          }
          onClose={() => setShowInterstitial(false)}
        />
      )}

      {/* Fixed close button — top-left. Hidden when the interstitial ad
          is up so we don't show two close buttons at once (the interstitial
          has its own top-right close). */}
      <Link
        href="/"
        className="feed-close-btn"
        aria-label="Close feed and go back"
        style={showInterstitial ? { display: "none" } : undefined}
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
            globalMuted={globalMuted}
            onMuteChange={setGlobalMuted}
            onBroken={handleBrokenCard}
          />
        ))}
      </div>
    </div>
  );
}
