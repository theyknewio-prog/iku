"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface FeedVideo {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  tags: string[];
  characters: string[];
  copyrights: string[];
  artists: string[];
  duration: number | null;
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function VideoPlayer({ video, isActive }: { video: FeedVideo; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive]);

  const title = video.characters[0]
    ? `${video.characters[0].replace(/_/g, " ")}${video.copyrights[0] ? ` — ${video.copyrights[0].replace(/_/g, " ")}` : ""}`
    : video.tags.slice(0, 3).map((t) => t.replace(/_/g, " ")).join(", ");

  return (
    <div className="home-player">
      {/* Video */}
      <div className="home-player__video-wrap">
        <video
          ref={videoRef}
          src={isActive ? video.url : undefined}
          poster={video.thumbnail}
          loop
          muted={muted}
          playsInline
          preload={isActive ? "auto" : "none"}
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted;
              setMuted(!muted);
            }
          }}
        />

        {/* Action buttons on the right side */}
        <div className="home-player__actions">
          <button
            className="home-player__action"
            onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          >
            <svg viewBox="0 0 24 24" fill={liked ? "#ff2080" : "none"} stroke={liked ? "#ff2080" : "white"} strokeWidth={2} width={24} height={24}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{formatScore(video.score)}</span>
          </button>

          <button
            className="home-player__action"
            onClick={(e) => {
              e.stopPropagation();
              navigator.share?.({ title, url: `https://iku.gg/watch/${video.slug}` });
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} width={24} height={24}>
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Share</span>
          </button>

          <button
            className="home-player__action"
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                videoRef.current.muted = !videoRef.current.muted;
                setMuted(!muted);
              }
            }}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} width={24} height={24}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} width={24} height={24}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
            <span>{muted ? "Sound" : "Mute"}</span>
          </button>
        </div>
      </div>

      {/* Info below video */}
      <div className="home-player__info">
        <div className="home-player__meta">
          {video.artists[0] && (
            <Link href={`/tag/${video.artists[0]}`} className="home-player__artist">
              {video.artists[0].replace(/_/g, " ")}
            </Link>
          )}
          <span className="home-player__dot">·</span>
          <Link href={`/watch/${video.slug}`} className="home-player__link">
            Full page →
          </Link>
        </div>

        <h2 className="home-player__title">{title}</h2>

        <div className="home-player__tags">
          {video.tags.slice(0, 6).map((tag) => (
            <Link key={tag} href={`/tag/${tag}`} className="tag-pill">
              #{tag.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        {/* Niches suggestion */}
        <div className="home-player__niches">
          <span className="home-player__niches-label">
            {video.characters.length + video.copyrights.length} Niches you might like
          </span>
        </div>
      </div>
    </div>
  );
}

export function HomeFeed({ initialVideos, mode }: { initialVideos: FeedVideo[]; mode: "trending" | "newest" }) {
  const [videos, setVideos] = useState(initialVideos);
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const sort = mode === "trending" ? "score" : "date";
      const res = await fetch(`/api/feed?page=${page + 1}&sort=${sort}`);
      const data = await res.json();
      if (data.videos?.length > 0) {
        setVideos((prev) => [...prev, ...data.videos]);
        setPage((p) => p + 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, loading, mode]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    obs.observe(sentinel);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [loadMore]);

  // Track active video
  useEffect(() => {
    const players = document.querySelectorAll(".home-player");
    if (!players.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 }
    );
    players.forEach((p) => obs.observe(p));
    return () => obs.disconnect();
  }, [videos.length]);

  return (
    <div className="home-feed">
      {videos.map((video, i) => (
        <div key={video.id} data-index={i}>
          <VideoPlayer video={video} isActive={i === activeIndex} />
        </div>
      ))}
      <div ref={sentinelRef} style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {loading && <div className="loader" />}
      </div>
    </div>
  );
}
