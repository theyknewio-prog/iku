"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { FeedVideo } from "./SwipeFeed";
import { useVideoShortcuts } from "@/hooks/useVideoShortcuts";
import { toggleFavorite, isFavorite } from "@/lib/favorites";
import { addToHistory } from "@/lib/history";

/* ── Helpers ──────────────────────────────────────────────── */

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ── SVG Icons ────────────────────────────────────────────── */

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={filled ? "#e8467c" : "none"}
      stroke={filled ? "#e8467c" : "#fff"}
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        filter: filled ? "drop-shadow(0 0 8px rgba(232,70,124,0.9))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
        transition: "fill 0.15s ease, filter 0.15s ease",
      }}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconBookmark({ filled }: { filled: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={filled ? "#f5c518" : "none"}
      stroke={filled ? "#f5c518" : "#fff"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        filter: filled ? "drop-shadow(0 0 8px rgba(245,197,24,0.85))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
        transition: "fill 0.15s ease, filter 0.15s ease",
      }}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconSoundOn() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconSoundOff() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Heart burst animation (matches WatchPlayer) ─────────── */

const HEART_BURST_STYLES = `
  @keyframes vc-heart-main {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.3); }
    50%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
  }
  @keyframes vc-heart-burst-0 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(10px, -40px) scale(0.8); }
  }
  @keyframes vc-heart-burst-1 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(-30px, -35px) scale(0.7); }
  }
  @keyframes vc-heart-burst-2 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(28px, -22px) scale(0.9); }
  }
  @keyframes vc-heart-burst-3 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(-22px, 18px) scale(0.6); }
  }
  @keyframes vc-heart-burst-4 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(38px, 12px) scale(0.8); }
  }
  @keyframes vc-heart-burst-5 {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    100% { opacity: 0; transform: translate(-14px, -52px) scale(0.7); }
  }
  @keyframes vc-btn-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    70%  { transform: scale(0.88); }
    100% { transform: scale(1); }
  }
  @keyframes vc-mute-fade {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
    15%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    70%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  }
`;

interface HeartBurst {
  x: number;
  y: number;
  id: number;
}

/* ── Action button ────────────────────────────────────────── */

function ActionBtn({
  onClick,
  ariaLabel,
  children,
  count,
  label,
  animating,
  active,
}: {
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  children: React.ReactNode;
  count?: string;
  label?: string;
  animating?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`feed-action${active ? " feed-action--active" : ""}${animating ? " feed-action--animating" : ""}`}
    >
      <span className="feed-action__circle">{children}</span>
      {count !== undefined && <span className="feed-action__count">{count}</span>}
      {label && <span className="feed-action__label">{label}</span>}
    </button>
  );
}

/* ── Component ─────────────────────────────────────────────── */

export function VideoCard({
  video,
  index,
  isActive,
  preloadNext = false,
  globalMuted = true,
  onMuteChange,
}: {
  video: FeedVideo;
  index: number;
  isActive: boolean;
  preloadNext?: boolean;
  globalMuted?: boolean;
  onMuteChange?: (muted: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hydrate initial state from localStorage (logged-in user's server state is
  // mirrored there via UserDataSync). Sharing a single "favorited" boolean for
  // both Like and Save keeps the data model simple — Save currently writes to
  // the same /api/favorites endpoint. A future UI split can add a dedicated
  // "saves" column without changing this surface.
  const [liked, setLiked] = useState(() => isFavorite(video.id));
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [saved, setSaved] = useState(() => isFavorite(video.id));
  const [saveAnimating, setSaveAnimating] = useState(false);
  // Per-card guard against re-firing video_view events on every mount/active
  // cycle. Reset when the card unmounts so a user who actually re-opens the
  // feed later still gets a fresh view event.
  const viewedRef = useRef(false);
  const [muted, setMuted] = useState(globalMuted);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [showMuteHint, setShowMuteHint] = useState(false);
  const [seekOverlay, setSeekOverlay] = useState<{ side: "left" | "right"; id: number } | null>(null);
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([]);

  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "center" | "right" | null>(null);

  /*
   * Force-sync `muted` state to the HTMLVideoElement imperatively.
   * React's `muted` prop on <video> has a known quirk (issue #10389):
   * the HTML attribute represents the INITIAL mute state, so changing
   * `muted={false}` after mount doesn't actually unmute — React just
   * removes the attribute, but the `.muted` property keeps its old value.
   * This effect guarantees the DOM stays in sync with our state.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (el && el.muted !== muted) {
      el.muted = muted;
    }
  }, [muted]);

  // Sync local muted state when parent's globalMuted changes
  // (e.g. user unmuted on another card, now this card should also be unmuted)
  useEffect(() => {
    setMuted(globalMuted);
  }, [globalMuted]);

  /* Keyboard shortcuts — only when active */

  /* Warm the proxy cache for proxied videos (rule34video, WP) as soon as the
   * card enters the preload buffer — well before it becomes active. This fires
   * a HEAD-like request to /api/video-stream which triggers the URL resolve
   * (380ms–1.4s) and caches the result. When the card actually becomes active,
   * the resolve is already done and streaming starts instantly from cache. */
  useEffect(() => {
    if (!preloadNext || isActive) return;
    const url = video.videoUrl;
    if (!url || !url.startsWith("/api/video-stream")) return;
    // Fire-and-forget fetch with range 0-1 to trigger resolve without
    // downloading the full video. AbortController prevents lingering requests.
    const ac = new AbortController();
    fetch(url, {
      signal: ac.signal,
      headers: { Range: "bytes=0-1" },
    }).catch(() => { /* benign: prefetch failed, will retry on play */ });
    return () => ac.abort();
  }, [preloadNext, isActive, video.videoUrl]);

  /* Auto-play / pause */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      // Silent: autoplay policy may reject on first mount before user gesture.
      el.play().catch(() => { /* autoplay policy */ });
    } else {
      el.pause();
      setProgress(0);
      setBuffered(0);
    }
  }, [isActive]);

  /* Build the display title/thumbnail used for favorites + history entries.
   * Matches the watch-page derivation so a Shorts save lands in /favorites with
   * the same label the user would see on the watch card. */
  const favoriteEntry = useCallback(() => {
    const title = video.character
      ? `${video.character.replace(/_/g, " ")}${
          video.copyright ? ` — ${video.copyright.replace(/_/g, " ")}` : ""
        }`
      : (video.tags || []).slice(0, 3).map((t) => t.replace(/_/g, " ")).join(", ") || "Untitled";
    return {
      id: video.id,
      slug: video.slug ?? "",
      title,
      thumbnail: video.thumbnail || "",
    };
  }, [video.id, video.slug, video.thumbnail, video.character, video.copyright, video.tags]);

  /* Record a history entry + score event once per active cycle.
   * Gated by a per-card ref so refreshing or swiping back within the same
   * session doesn't re-fire the view. The Danbooru `addToHistory` helper
   * already deduplicates inside localStorage but it re-fires the scoring /
   * PostHog events every call — that's what we want to suppress. */
  useEffect(() => {
    if (!isActive || viewedRef.current || !video.slug) return;
    const t = setTimeout(() => {
      viewedRef.current = true;
      const entry = favoriteEntry();
      addToHistory(entry.id, entry.slug, entry.thumbnail, entry.title);
    }, 2000); // 2s watch time before we count it as a real view
    return () => clearTimeout(t);
  }, [isActive, video.slug, favoriteEntry]);

  /* Progress + buffered tracking */
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration || seeking) return;
    setProgress((el.currentTime / el.duration) * 100);
  }, [seeking]);

  const handleProgress = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration || !el.buffered.length) return;
    const end = el.buffered.end(el.buffered.length - 1);
    setBuffered((end / el.duration) * 100);
  }, []);

  /* Toggle mute.
   *
   * Silent bug avoidance (see CLAUDE.md) — the <video> element's `muted`
   * attribute is controlled by React via `muted={muted}`. Mutating `el.muted`
   * directly creates a race: React's next render re-applies the stale prop
   * and the video can re-mute milliseconds after our change. The fix is to
   * update ONLY the state and let React drive the attribute. We still
   * imperatively call `el.play()` after unmuting because some desktop
   * browsers pause an autoplaying muted video the first time it unmutes.
   */
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      const el = videoRef.current;
      if (el) {
        if (!next) {
          if (el.volume === 0) el.volume = 0.5;
          el.play().catch(() => {});
        }
      }
      // Propagate to parent so ALL subsequent cards inherit this mute state
      onMuteChange?.(next);
      setShowMuteHint(true);
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      muteTimerRef.current = setTimeout(() => setShowMuteHint(false), 900);
      return next;
    });
  }, [onMuteChange]);

  // Keyboard shortcuts — route mute through toggleMute so React state stays
  // in sync with the DOM (see CLAUDE.md silent-bug section).
  useVideoShortcuts(isActive ? videoRef : { current: null }, {
    onMuteToggle: toggleMute,
  });

  /* Seek overlay */
  const showSeekFeedback = useCallback((side: "left" | "right") => {
    if (seekOverlayTimerRef.current) clearTimeout(seekOverlayTimerRef.current);
    setSeekOverlay({ side, id: Date.now() });
    seekOverlayTimerRef.current = setTimeout(() => setSeekOverlay(null), 800);
  }, []);

  /* Unified favorite toggle — single source of truth.
   * The Like button, Save button, and center double-tap heart burst all call
   * this. Handles localStorage + server sync + score event + PostHog via
   * `toggleFavorite`. `mode` lets the caller "add-only" (heart burst never
   * removes) or "toggle" (button taps). */
  const applyFavorite = useCallback(
    (mode: "toggle" | "add") => {
      if (!video.slug) return liked;
      if (mode === "add" && liked) return true;
      const next = toggleFavorite(favoriteEntry());
      setLiked(next);
      setSaved(next);
      if (next) {
        setLikeAnimating(true);
        setSaveAnimating(true);
        setTimeout(() => {
          setLikeAnimating(false);
          setSaveAnimating(false);
        }, 350);
      }
      return next;
    },
    [video.slug, liked, favoriteEntry]
  );

  /* Heart burst — TikTok-style center double-tap animation. */
  const triggerHeartBurst = useCallback(
    (x: number, y: number) => {
      const burst: HeartBurst = { x, y, id: Date.now() };
      setHeartBursts((prev) => [...prev, burst]);
      // Double-tap heart burst = add to favorites (never remove — standard
      // TikTok UX so accidental double-taps can't delete).
      applyFavorite("add");
      setTimeout(() => {
        setHeartBursts((prev) => prev.filter((b) => b.id !== burst.id));
      }, 700);
    },
    [applyFavorite]
  );

  /* Progress bar seek — pointer events for drag + click */
  const seekToPercent = useCallback((clientX: number) => {
    const el = videoRef.current;
    const track = progressTrackRef.current;
    if (!el || !track || !el.duration) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
    setProgress(pct * 100);
  }, []);

  const handleProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSeeking(true);
      setProgressExpanded(true);
      seekToPercent(e.clientX);
    },
    [seekToPercent]
  );

  const handleProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!seeking) return;
      e.stopPropagation();
      seekToPercent(e.clientX);
    },
    [seeking, seekToPercent]
  );

  const handleProgressPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setSeeking(false);
      setProgressExpanded(false);
      seekToPercent(e.clientX);
    },
    [seekToPercent]
  );

  /* Custom double-tap handler on the video area (left/center/right) */
  const handleVideoTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't fire if tap originated on the progress bar
      if ((e.target as HTMLElement).closest("[data-progress-bar]")) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      lastClickRef.current = { x: e.clientX, y: e.clientY };

      const relX = e.clientX - rect.left;
      const third = rect.width / 3;
      const side: "left" | "center" | "right" =
        relX < third ? "left" : relX > third * 2 ? "right" : "center";

      const now = Date.now();
      const delta = now - lastTapTimeRef.current;
      const sameSide = lastTapSideRef.current === side;

      if (delta < 300 && sameSide) {
        // Double tap
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        lastTapTimeRef.current = 0;
        lastTapSideRef.current = null;

        const el = videoRef.current;
        if (side === "center") {
          const relY = e.clientY - rect.top;
          triggerHeartBurst(relX, relY);
        } else if (el) {
          if (side === "left") {
            el.currentTime = Math.max(0, el.currentTime - 10);
          } else {
            el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
          }
          showSeekFeedback(side);
        }
      } else {
        // First tap — schedule single-tap action (mute toggle)
        lastTapTimeRef.current = now;
        lastTapSideRef.current = side;
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          toggleMute();
        }, 300);
      }
    },
    [triggerHeartBurst, showSeekFeedback, toggleMute]
  );

  const shouldLoad = isActive || preloadNext;

  /* Display metadata — curated for readability */
  const artistDisplay = video.artist
    ? `@${video.artist.replace(/_/g, "").toLowerCase()}`
    : null;

  // Tags to exclude from display (generic/meta tags that add no value)
  const HIDDEN_TAGS = new Set([
    "animated", "video", "sound", "has_audio", "webm", "mp4",
    "1boy", "1girl", "1girls", "2girls", "1futa", "2boys",
    "solo", "solo_female", "solo_male", "tagme",
    "3d", "2d", "highres", "absurdres", "commentary",
    "english_commentary", "japanese_text",
  ]);

  // Build a clean title: character name > copyright > curated tags
  const charName = video.character?.replace(/_/g, " ");
  const seriesName = video.copyright?.replace(/_/g, " ");
  const title = charName
    ? seriesName
      ? `${charName} — ${seriesName}`
      : charName
    : seriesName
      ? seriesName
      : video.tags
          .filter((t) => !HIDDEN_TAGS.has(t))
          .slice(0, 2)
          .map((t) => t.replace(/_/g, " "))
          .join(", ") || "Untitled";

  // Curated tags: filter out noise, show the interesting ones
  const displayTags = video.tags
    .filter((t) => !HIDDEN_TAGS.has(t) && t !== video.character && t !== video.copyright)
    .slice(0, 4)
    .filter(Boolean);

  const watchHref = video.slug ? `/watch/${video.slug}` : null;

  return (
    <div
      ref={containerRef}
      className="feed-item"
      data-index={index}
    >
      {/* Inject keyframe animations once */}
      <style>{HEART_BURST_STYLES}</style>

      {/* Poster + spinner while loading */}
      {!loaded && isActive && (
        <>
          {video.thumbnail && (
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
          <div className="feed-loading-spinner" style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 6,
          }}>
            <div className="loader" />
          </div>
        </>
      )}

      {/* Video — tap zone */}
      <div
        style={{ position: "absolute", inset: 0 }}
        onClick={handleVideoTap}
      >
        <video
          ref={videoRef}
          src={shouldLoad ? video.videoUrl : undefined}
          poster={video.thumbnail}
          loop
          muted={muted}
          playsInline
          preload={isActive ? "auto" : shouldLoad ? "metadata" : "none"}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          onLoadedData={() => setLoaded(true)}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
        />
      </div>

      {/* Seek overlay (±10s feedback) */}
      {seekOverlay && (
        <div
          key={seekOverlay.id}
          className={`seek-overlay seek-overlay--${seekOverlay.side}`}
          aria-hidden="true"
        >
          {seekOverlay.side === "left" ? "◄◄ 10s" : "10s ►►"}
        </div>
      )}

      {/* Mute indicator */}
      {showMuteHint && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "vc-mute-fade 0.9s ease forwards",
            pointerEvents: "none",
            zIndex: 15,
          }}
        >
          {muted ? <IconSoundOff /> : <IconSoundOn />}
        </div>
      )}

      {/* Heart bursts (center double-tap) */}
      {heartBursts.map((burst) => (
        <div
          key={burst.id}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: burst.x,
            top: burst.y,
            zIndex: 9,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              color: "#e8467c",
              fontSize: 44,
              lineHeight: 1,
              animation: "vc-heart-main 0.6s ease forwards",
            }}
          >
            ♥
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                color: "#e8467c",
                fontSize: 16,
                lineHeight: 1,
                opacity: 0.85,
                animation: `vc-heart-burst-${i} 0.5s ease forwards`,
              }}
            >
              ♥
            </div>
          ))}
        </div>
      ))}

      {/* ── Right action sidebar ─────────────────────────── */}
      <div className="feed-actions-rail">
        {/* Heart / Like — persists to localStorage + server via toggleFavorite */}
        <ActionBtn
          onClick={(e) => {
            e.stopPropagation();
            applyFavorite("toggle");
          }}
          ariaLabel={liked ? "Unlike" : "Like"}
          count={formatScore(video.score + (liked ? 1 : 0))}
          label="Like"
          animating={likeAnimating}
          active={liked}
        >
          <IconHeart filled={liked} />
        </ActionBtn>

        {/* Bookmark / Save — shares the same favorite store */}
        <ActionBtn
          onClick={(e) => {
            e.stopPropagation();
            applyFavorite("toggle");
          }}
          ariaLabel={saved ? "Unsave" : "Save"}
          label="Save"
          animating={saveAnimating}
          active={saved}
        >
          <IconBookmark filled={saved} />
        </ActionBtn>

        {/* Share */}
        <ActionBtn
          onClick={async (e) => {
            e.stopPropagation();
            const url = watchHref
              ? `https://iku.gg${watchHref}`
              : window.location.href;
            try {
              if (navigator.share) {
                await navigator.share({ title: "iku.gg", url });
              } else {
                await navigator.clipboard.writeText(url);
              }
            } catch {
              // user cancelled or clipboard failed — silent
            }
          }}
          ariaLabel="Share"
          label="Share"
        >
          <IconShare />
        </ActionBtn>

        {/* Sound */}
        <ActionBtn
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          ariaLabel={muted ? "Unmute" : "Mute"}
          label={muted ? "Sound" : "Mute"}
        >
          {muted ? <IconSoundOff /> : <IconSoundOn />}
        </ActionBtn>

        {/* Watch full page */}
        {watchHref ? (
          <Link
            href={watchHref}
            aria-label="Watch full video"
            onClick={(e) => e.stopPropagation()}
            className="feed-action"
          >
            <span className="feed-action__circle">
              <IconExternalLink />
            </span>
            <span className="feed-action__label">Watch</span>
          </Link>
        ) : null}
      </div>

      {/* ── Bottom overlay (artist, title, tags) ─────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          /* leave right side clear for action bar, bottom clear for progress bar */
          paddingRight: 70,
          paddingLeft: 16,
          paddingBottom: "max(52px, calc(env(safe-area-inset-bottom) + 48px))",
          paddingTop: 80,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* Artist */}
        {artistDisplay && (
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 1px 6px rgba(0,0,0,0.7)",
              letterSpacing: "0.01em",
              lineHeight: 1.3,
            }}
          >
            {artistDisplay}
          </p>
        )}

        {/* Title */}
        {title && (
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 13,
              fontWeight: 400,
              color: "rgba(255,255,255,0.92)",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.4,
            }}
          >
            {title}
          </p>
        )}

        {/* Tags — horizontally scrollable row */}
        {displayTags.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              pointerEvents: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {displayTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.88)",
                  background: "rgba(255,255,255,0.14)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  borderRadius: 20,
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Seekable progress bar (bottom edge) ─────────── */}
      {isActive && (
        <div
          ref={progressTrackRef}
          data-progress-bar
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          onPointerCancel={handleProgressPointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            height: progressExpanded ? 32 : 24,
            zIndex: 20,
            cursor: "pointer",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Visual track */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: progressExpanded ? 6 : 4,
              background: "rgba(255,255,255,0.2)",
              borderRadius: 99,
              transition: seeking ? "none" : "height 0.12s ease",
              overflow: "visible",
            }}
          >
            {/* Buffered */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${buffered}%`,
                background: "rgba(255,255,255,0.25)",
                borderRadius: 99,
              }}
            />
            {/* Played */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progress}%`,
                background: "#e8467c",
                borderRadius: 99,
                transition: seeking ? "none" : "width 0.1s linear",
              }}
            />
            {/* Thumb — always visible */}
            <div
              style={{
                position: "absolute",
                left: `${progress}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: progressExpanded ? 16 : 12,
                height: progressExpanded ? 16 : 12,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                pointerEvents: "none",
                transition: "width 0.12s, height 0.12s",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
