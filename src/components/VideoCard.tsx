"use client";

import { useRef, useEffect, useState } from "react";
import Hls from "hls.js";

interface VideoItem {
  id: number;
  slug: string;
  title: string;
  cover: string;
  views: number;
  tags: string[];
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${Math.floor(views / 1_000)}K`;
  return String(views);
}

export function VideoCard({
  video,
  index,
  isActive,
}: {
  video: VideoItem;
  index: number;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(false);

  // Resolve stream URL when active
  useEffect(() => {
    if (!isActive || streamUrl || resolving) return;

    setResolving(true);
    fetch(`/api/resolve?slug=${video.slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setStreamUrl(data.url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setResolving(false));
  }, [isActive, video.slug, streamUrl, resolving]);

  // HLS playback
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !streamUrl) return;

    if (!isActive) {
      el.pause();
      return;
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        startLevel: -1,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        el.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(true);
      });
      hlsRef.current = hls;
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = streamUrl;
      el.addEventListener("loadedmetadata", () => el.play().catch(() => {}), {
        once: true,
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isActive, streamUrl]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  return (
    <div className="feed-item" data-index={index}>
      {/* Cover/loading state */}
      {(!streamUrl || resolving) && isActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <img
            src={video.cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md"
          />
          <div className="z-20 flex flex-col items-center gap-3">
            <div className="loader" />
            <span className="text-[#888] text-xs">loading video...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && isActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <img
            src={video.cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md"
          />
          <div className="z-20 flex flex-col items-center gap-3">
            <span className="text-[#888] text-sm">failed to load — swipe to next</span>
          </div>
        </div>
      )}

      {/* Video poster when not active */}
      {!isActive && (
        <div className="absolute inset-0 bg-black">
          <img
            src={video.cover}
            alt=""
            className="w-full h-full object-cover opacity-60"
            loading="lazy"
          />
        </div>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-contain bg-black"
        onClick={toggleMute}
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
          <span>{liked ? "liked" : "like"}</span>
        </button>

        <button
          className="feed-action-btn"
          onClick={() =>
            navigator.share?.({ title: video.title, url: window.location.href })
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
        <h2 className="text-white font-semibold text-sm mb-2 line-clamp-2">
          {video.title}
        </h2>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {video.tags.map((tag) => (
            <span key={tag} className="tag-pill">
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        <p className="text-xs text-white/40">{formatViews(video.views)} views</p>
      </div>
    </div>
  );
}
