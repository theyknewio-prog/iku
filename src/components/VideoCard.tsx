"use client";

import { useRef, useEffect, useState } from "react";

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

interface VideoCardProps {
  video: VideoItem;
  index: number;
  isActive: boolean;
}

export function VideoCard({ video, index, isActive }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);

  // Auto play/pause based on visibility
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

  const handleLike = () => {
    setLiked(!liked);
    // TODO: store liked tags in localStorage for recommendation engine
  };

  return (
    <div className="feed-item" data-index={index}>
      {/* Video player */}
      <video
        ref={videoRef}
        src={isActive || Math.abs(index) < 3 ? video.embedUrl : undefined}
        poster={video.thumbnail}
        loop
        muted={muted}
        playsInline
        preload={isActive ? "auto" : "metadata"}
        className="w-full h-full object-contain bg-black"
        onClick={toggleMute}
      />

      {/* Side actions */}
      <div className="feed-actions">
        {/* Like */}
        <button className="feed-action-btn" onClick={handleLike}>
          <svg
            viewBox="0 0 24 24"
            fill={liked ? "#e879f9" : "none"}
            stroke={liked ? "#e879f9" : "currentColor"}
            strokeWidth={2}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{liked ? "liked" : "like"}</span>
        </button>

        {/* Share */}
        <button
          className="feed-action-btn"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: "iku", url: window.location.href });
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>share</span>
        </button>

        {/* Sound toggle */}
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

        {/* Source */}
        <button className="feed-action-btn opacity-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{video.source}</span>
        </button>
      </div>

      {/* Bottom overlay with info */}
      <div className="feed-overlay">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {video.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {/* Views */}
        {video.views && video.views !== "0" && (
          <p className="text-xs text-white/50">
            ★ {video.views} score
          </p>
        )}
      </div>
    </div>
  );
}
