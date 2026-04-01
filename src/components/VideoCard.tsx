"use client";

import { useState } from "react";

interface VideoItem {
  id: string;
  title: string;
  videoId: string;
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
  const [liked, setLiked] = useState(false);

  const embedUrl = `https://www.xvideos.com/embedframe/${video.videoId}`;

  return (
    <div className="feed-item" data-index={index}>
      {/* Embed player — only load when active or near active */}
      {isActive || Math.abs(index) <= 1 ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay"
          loading={isActive ? "eager" : "lazy"}
        />
      ) : (
        /* Placeholder with thumbnail */
        <div className="w-full h-full bg-black flex items-center justify-center">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt=""
              className="w-full h-full object-cover opacity-60"
              loading="lazy"
            />
          ) : (
            <div className="loader" />
          )}
        </div>
      )}

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
          <span>{liked ? "liked" : "like"}</span>
        </button>

        <button
          className="feed-action-btn"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: video.title, url: window.location.href });
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
      </div>

      {/* Bottom overlay */}
      <div className="feed-overlay">
        <h2 className="text-white font-semibold text-sm mb-2 line-clamp-2">
          {video.title}
        </h2>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {video.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {video.duration && (
          <p className="text-xs text-white/50">{video.duration}</p>
        )}
      </div>
    </div>
  );
}
