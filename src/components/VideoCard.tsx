"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { FeedVideo } from "./SwipeFeed";
import { useVideoShortcuts } from "@/hooks/useVideoShortcuts";
import { useDoubleTap } from "@/hooks/useDoubleTap";

/* ── Helpers ──────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.floor(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/* ── Component ─────────────────────────────────────────────── */

export function VideoCard({
  video,
  index,
  isActive,
  preloadNext = false,
}: {
  video: FeedVideo;
  index: number;
  isActive: boolean;
  preloadNext?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const [seekOverlay, setSeekOverlay] = useState<{ side: "left" | "right"; id: number } | null>(null);
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Keyboard shortcuts — only when this card is active */
  useVideoShortcuts(isActive ? videoRef : { current: null });

  /* Auto-play / pause based on active state */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
      setProgress(0);
    }
  }, [isActive]);

  /* Progress tracking */
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress((el.currentTime / el.duration) * 100);
  }, []);

  /* Toggle mute with visual hint */
  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);

    /* Flash mute indicator */
    setShowMuteHint(true);
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => setShowMuteHint(false), 900);
  }, []);

  /* Show seek overlay briefly */
  const showSeekOverlay = useCallback((side: "left" | "right") => {
    if (seekOverlayTimerRef.current) clearTimeout(seekOverlayTimerRef.current);
    setSeekOverlay({ side, id: Date.now() });
    seekOverlayTimerRef.current = setTimeout(() => setSeekOverlay(null), 800);
  }, []);

  /* Double-tap seek */
  const { handleClick: handleDoubleTap } = useDoubleTap({
    onDoubleTap: (side) => {
      const el = videoRef.current;
      if (!el || !side) return;
      if (side === "left") {
        el.currentTime = Math.max(0, el.currentTime - 10);
      } else {
        el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
      }
      showSeekOverlay(side);
    },
    onSingleTap: toggleMute,
  });

  /* Preload active + next 1 video for smooth swiping */
  const shouldLoad = isActive || preloadNext;

  /* Build display title */
  const title = video.character
    ? `${video.character.replace(/_/g, " ")}${
        video.copyright ? ` — ${video.copyright.replace(/_/g, " ")}` : ""
      }`
    : video.tags
        .slice(0, 3)
        .map((t) => t.replace(/_/g, " "))
        .join(", ");

  const displayTags = video.tags
    .slice(0, 5)
    .filter(Boolean);

  return (
    <div className="feed-item" data-index={index}>
      {/* Progress bar */}
      {isActive && (
        <div className="feed-progress">
          <div
            className="feed-progress__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Loading — show poster thumbnail instead of black + spinner */}
      {!loaded && isActive && video.thumbnail && (
        <img
          src={video.thumbnail}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 5,
            background: "#000",
          }}
        />
      )}

      {/* Video element — wrapped for double-tap seek */}
      <div
        style={{ position: "absolute", inset: 0 }}
        onClick={handleDoubleTap}
      >
        <video
          ref={videoRef}
          src={shouldLoad ? video.videoUrl : undefined}
          poster={video.thumbnail}
          loop
          muted={muted}
          playsInline
          preload={isActive ? "auto" : "none"}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          onLoadedData={() => setLoaded(true)}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>

      {/* Seek overlay */}
      {seekOverlay && (
        <div
          key={seekOverlay.id}
          className={`seek-overlay seek-overlay--${seekOverlay.side}`}
          aria-hidden="true"
        >
          {seekOverlay.side === "left" ? "◄◄ 10s" : "10s ►►"}
        </div>
      )}

      {/* Mute indicator (flashes on tap) */}
      {showMuteHint && (
        <div className="feed-muted-indicator">
          {muted ? (
            /* muted icon */
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            /* unmuted icon */
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </div>
      )}

      {/* Side action buttons */}
      <div className="feed-actions">
        {/* Like */}
        <button
          className={`feed-action-btn${liked ? " feed-action-btn--liked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setLiked(!liked);
          }}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <svg
            viewBox="0 0 24 24"
            fill={liked ? "#ff2080" : "none"}
            stroke={liked ? "#ff2080" : "currentColor"}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{formatScore(video.score + (liked ? 1 : 0))}</span>
        </button>

        {/* Share */}
        <button
          className="feed-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.share?.({ title: "iku.gg", url: window.location.href });
          }}
          aria-label="Share"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>share</span>
        </button>

        {/* Mute toggle */}
        <button
          className="feed-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span>{muted ? "sound" : "mute"}</span>
        </button>
      </div>

      {/* Bottom overlay — title, tags, artist */}
      <div className="feed-overlay">
        {/* Title */}
        {title && (
          <h2 className="feed-title">{title}</h2>
        )}

        {/* Tags */}
        {displayTags.length > 0 && (
          <div className="feed-tags">
            {displayTags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Artist + file info */}
        {(video.artist || video.size) && (
          <div className="feed-artist">
            {video.artist && (
              <>
                <span>
                  {video.artist.replace(/_/g, " ")}
                </span>
                {video.size > 0 && <span className="feed-artist-dot" />}
              </>
            )}
            {video.size > 0 && (
              <span>{formatSize(video.size)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
