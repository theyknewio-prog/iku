"use client";

import { useRef, useEffect, useState } from "react";
import Hls from "hls.js";

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
  const hlsRef = useRef<Hls | null>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  // HLS setup + play/pause
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      const url = video.embedUrl;

      if (url.includes(".m3u8")) {
        // HLS stream
        if (Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new Hls({
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
          });
          hls.loadSource(url);
          hls.attachMedia(el);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            el.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setLoading(false);
            }
          });
          hlsRef.current = hls;
        } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari native HLS
          el.src = url;
          el.addEventListener("loadedmetadata", () => {
            setLoading(false);
            el.play().catch(() => {});
          }, { once: true });
        }
      } else {
        // Direct MP4/WebM
        el.src = url;
        el.addEventListener("loadeddata", () => {
          setLoading(false);
          el.play().catch(() => {});
        }, { once: true });
      }
    } else {
      // Not active — pause and cleanup
      el.pause();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isActive, video.embedUrl]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
  };

  return (
    <div className="feed-item" data-index={index}>
      {/* Poster/thumbnail while loading */}
      {loading && isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <img
            src={video.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm"
          />
          <div className="loader z-20" />
        </div>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        poster={video.thumbnail}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-contain bg-black"
        onClick={toggleMute}
      />

      {/* Side actions */}
      <div className="feed-actions">
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
        {/* Title */}
        <h2 className="text-white font-semibold text-sm mb-2 line-clamp-2">
          {video.title}
        </h2>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {video.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {/* Views */}
        <p className="text-xs text-white/50">
          {video.views} views
        </p>
      </div>
    </div>
  );
}
