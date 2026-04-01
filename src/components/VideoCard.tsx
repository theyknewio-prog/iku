"use client";

import { useRef, useEffect, useState } from "react";
import type { FeedVideo } from "./SwipeFeed";

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes >= 1_000) return `${Math.floor(bytes / 1_000)}KB`;
  return `${bytes}B`;
}

export function VideoCard({
  video,
  index,
  isActive,
}: {
  video: FeedVideo;
  index: number;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Autoplay when active, pause when not
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  // Only load video src when near active (±2 positions)
  const shouldLoad = Math.abs(index - (isActive ? index : index)) <= 2 || isActive;
  const title = video.character
    ? `${video.character.replace(/_/g, " ")}${video.copyright ? ` — ${video.copyright.replace(/_/g, " ")}` : ""}`
    : video.tags.slice(0, 3).map(t => t.replace(/_/g, " ")).join(", ");

  return (
    <div className="feed-item" data-index={index}>
      {/* Loading state */}
      {!loaded && isActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="loader" />
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={shouldLoad ? video.videoUrl : undefined}
        poster={video.thumbnail}
        loop
        muted={muted}
        playsInline
        preload={isActive ? "auto" : "none"}
        className="w-full h-full object-contain bg-black"
        onClick={toggleMute}
        onLoadedData={() => setLoaded(true)}
      />

      {/* Side actions */}
      <div className="feed-actions">
        <button className="feed-action-btn" onClick={() => setLiked(!liked)}>
          <svg
            viewBox="0 0 24 24"
            fill={liked ? "#e879f9" : "none"}
            stroke={liked ? "#e879f9" : "currentColor"}
            strokeWidth={2}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{video.score}</span>
        </button>

        <button
          className="feed-action-btn"
          onClick={() =>
            navigator.share?.({ title: "iku.gg", url: window.location.href })
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>share</span>
        </button>

        <button className="feed-action-btn" onClick={toggleMute}>
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span>{muted ? "unmute" : "mute"}</span>
        </button>
      </div>

      {/* Bottom overlay */}
      <div className="feed-overlay">
        <h2 className="text-white font-semibold text-sm mb-2 line-clamp-1">
          {title}
        </h2>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {video.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {video.artist && (
          <p className="text-xs text-white/40">
            🎨 {video.artist.replace(/_/g, " ")} · {formatSize(video.size)}
          </p>
        )}
      </div>
    </div>
  );
}
