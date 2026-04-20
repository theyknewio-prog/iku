"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { filterByBlacklist } from "@/lib/blacklist";
import { buildTitle } from "@/lib/video-display";
import type { Video } from "@/types/video";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Format seconds → "MM:SS" */
function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────
   SVG Icons
───────────────────────────────────────────── */

function IconEye() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "#ff2080" : "none"}
      stroke={filled ? "#ff2080" : "currentColor"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 56 56" fill="none" width={56} height={56}>
      {/* Outer circle — glassmorphism dark */}
      <circle cx="28" cy="28" r="26" fill="rgba(0,0,0,0.50)" />
      <circle
        cx="28"
        cy="28"
        r="26"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      {/* Play triangle — slightly offset for optical centering */}
      <polygon points="23,18 23,38 42,28" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   VideoPlayerCard
───────────────────────────────────────────── */

function VideoPlayerCard({
  video,
  isActive,
  nearActive = false,
}: {
  video: FeedVideo;
  isActive: boolean;
  nearActive?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [remaining, setRemaining] = useState<string>("00:00");
  const [seeking, setSeeking] = useState(false);

  // Derived display values — shared buildTitle so Shorts labels match the
  // rest of the app (cards, h1, metadata). FeedVideo is structurally compatible
  // with Video's readable fields (characters/copyrights/tags/title).
  const artist = video.artists[0] ?? null;
  const title = buildTitle(video as unknown as Video);

  // ── Autoplay / pause on visibility ──────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive || nearActive) {
      // Preload src for active and nearby videos
      if (!el.src && video.url) {
        el.src = video.url;
        el.load();
      }
    }

    if (isActive) {
      // Silent: browser autoplay policy may reject until user gestures.
      // We don't log — it fires on every first-load before interaction.
      el.play().catch(() => {
        /* autoplay policy */
      });
    } else {
      el.pause();
    }
  }, [isActive, nearActive, video.url]);

  // ── Sync playing state ───────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  // ── Progress bar ─────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    function onTimeUpdate() {
      if (seeking) return;
      const dur = el!.duration;
      const cur = el!.currentTime;
      if (!dur || !isFinite(dur)) return;
      const ratio = cur / dur;
      setProgress(ratio);
      setRemaining(fmt(dur - cur));

      // Sync the range input
      if (seekRef.current) {
        seekRef.current.value = String(ratio * 1000);
      }
    }

    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [seeking]);

  // ── Click to play/pause ──────────────────────
  const handleVideoClick = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      // Click IS a user gesture — play() shouldn't reject, but guard anyway.
      el.play().catch(() => {
        /* gesture already consumed */
      });
    } else {
      el.pause();
    }
  }, []);

  // ── Seek bar interaction ─────────────────────
  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = videoRef.current;
      if (!el || !el.duration) return;
      const ratio = Number(e.target.value) / 1000;
      el.currentTime = ratio * el.duration;
      setProgress(ratio);
      setRemaining(fmt(el.duration - el.currentTime));
    },
    [],
  );

  // ── Mute toggle ──────────────────────────────
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  // ── Like ─────────────────────────────────────
  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked((v) => !v);
  }, []);

  // ── Share ────────────────────────────────────
  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = `https://iku.gg/watch/${video.slug}`;
      if (navigator.share) {
        // Silent: user can cancel the share sheet. That rejection is not an error.
        navigator.share({ title, url }).catch(() => {
          /* user dismissed */
        });
      } else {
        navigator.clipboard?.writeText(url).catch(() => {
          /* permission denied */
        });
      }
    },
    [video.slug, title],
  );

  return (
    <article className="gif-preview">
      {/* ── Blurred backdrop (ambient glow effect) ── */}
      <div className="gif-preview__backdrop">
        <img
          src={video.thumbnail}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* ── Player area ── */}
      <div className="gif-preview__player" onClick={handleVideoClick}>
        <video
          ref={videoRef}
          poster={video.thumbnail}
          loop
          muted={muted}
          playsInline
          preload="none"
          className="gif-preview__video"
        />

        {/* Poster image (shown before video starts) */}
        {!playing && (
          <img
            src={video.thumbnail}
            alt={title}
            className="gif-preview__poster"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Dark overlay for controls visibility */}
        <div className="gif-preview__overlayer" />

        {/* Play button — hidden while playing */}
        {!playing && (
          <div className="gif-preview__play-btn" aria-label="Play">
            <IconPlay />
          </div>
        )}

        {/* ── Right sidebar actions (overlaid on video) ── */}
        <div className="gif-preview__sidebar">
          {/* Views */}
          <div className="gif-preview__action gif-preview__action--views">
            <IconEye />
            <span>{formatScore(video.score)}</span>
          </div>

          {/* Like */}
          <button
            className={`gif-preview__action gif-preview__action--btn${liked ? " gif-preview__action--liked" : ""}`}
            onClick={handleLike}
            aria-label={liked ? "Unlike" : "Like"}
            type="button"
          >
            <IconHeart filled={liked} />
            <span>
              {liked ? formatScore(video.score + 1) : formatScore(video.score)}
            </span>
          </button>

          {/* Share */}
          <button
            className="gif-preview__action gif-preview__action--btn"
            onClick={handleShare}
            aria-label="Share"
            type="button"
          >
            <IconShare />
            <span>Share</span>
          </button>

          {/* Sound */}
          <button
            className="gif-preview__action gif-preview__action--btn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            type="button"
          >
            {muted ? <IconSoundOff /> : <IconSoundOn />}
            <span>{muted ? "Sound" : "Mute"}</span>
          </button>

          {/* Expand / watch page */}
          <Link
            href={`/watch/${video.slug}`}
            className="gif-preview__action gif-preview__action--btn"
            aria-label="Watch full page"
            onClick={(e) => e.stopPropagation()}
            prefetch={false}
          >
            <IconExpand />
            <span>Full</span>
          </Link>
        </div>

        {/* ── Overlay info (bottom-left, over video) ── */}
        <div
          className="gif-preview__overlay-info"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Avatar + username */}
          <div className="gif-preview__user">
            <div className="gif-preview__avatar" aria-hidden="true">
              {artist ? artist[0].toUpperCase() : "?"}
            </div>
            {artist ? (
              <Link
                href={`/tag/${artist}`}
                className="gif-preview__username"
                onClick={(e) => e.stopPropagation()}
              >
                {artist.replace(/_/g, " ")}
              </Link>
            ) : (
              <span className="gif-preview__username gif-preview__username--anon">
                Anonymous
              </span>
            )}
          </div>

          {/* Description / title */}
          {title && <p className="gif-preview__description">{title}</p>}

          {/* Hashtags */}
          {video.tags.length > 0 && (
            <div className="gif-preview__tags">
              {video.tags.slice(0, 5).map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${tag}`}
                  className="tag-pill"
                  onClick={(e) => e.stopPropagation()}
                  prefetch={false}
                >
                  #{tag.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Progress bar at bottom of player ── */}
        <div className="gif-preview__progress-bar">
          <div className="gif-preview__seek-wrap">
            {/* Filled track */}
            <div className="gif-preview__seek-track">
              <div
                className="gif-preview__seek-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            {/* Range input for seeking */}
            <input
              ref={seekRef}
              className="gif-preview__seek-input"
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              step={1}
              aria-label="Seek"
              onMouseDown={() => setSeeking(true)}
              onTouchStart={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onTouchEnd={() => setSeeking(false)}
              onChange={handleSeekChange}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {/* Countdown */}
          <span className="gif-preview__countdown">{remaining}</span>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────
   HomeFeed
───────────────────────────────────────────── */

export function HomeFeed({
  initialVideos,
  mode,
}: {
  initialVideos: FeedVideo[];
  mode: "trending" | "newest";
}) {
  const [videos, setVideos] = useState(
    () =>
      filterByBlacklist(
        initialVideos as import("@/types/video").Video[],
      ) as FeedVideo[],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Session offset: received from the first API response and forwarded to every
  // subsequent request so the infinite-scroll pages stay in the same catalog slice.
  const [sessionOffset, setSessionOffset] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Infinite scroll sentinel ─────────────────
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const sort = mode === "trending" ? "score" : "date";
      const nextPage = page + 1;
      // Include the session offset so the server returns the right catalog slice.
      // On page 1 we have no offset yet — the server will generate one and send it back.
      const offsetParam =
        sessionOffset !== null ? `&offset=${sessionOffset}` : "";
      const res = await fetch(
        `/api/feed?page=${nextPage}&sort=${sort}${offsetParam}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      // Capture the offset from the first response so all future pages use it.
      if (sessionOffset === null && typeof data.offset === "number") {
        setSessionOffset(data.offset);
      }
      if (data.videos?.length > 0) {
        const incoming = filterByBlacklist(data.videos) as FeedVideo[];
        setVideos((prev) => [...prev, ...incoming]);
        setPage(nextPage);
        setHasMore(data.hasMore ?? true);
      } else {
        setHasMore(false);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, loading, mode, hasMore, sessionOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadMore]);

  // ── Active video tracking ────────────────────
  useEffect(() => {
    const refs = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!refs.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 },
    );
    refs.forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, [videos.length]);

  return (
    <div className="home-feed">
      {videos.map((video, i) => (
        <div
          key={video.id}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          data-index={i}
        >
          <VideoPlayerCard
            video={video}
            isActive={i === activeIndex}
            nearActive={Math.abs(i - activeIndex) <= 2}
          />
        </div>
      ))}

      {/* Sentinel + loader */}
      <div ref={sentinelRef} className="home-feed__sentinel">
        {loading && <div className="loader" />}
        {!hasMore && !loading && (
          <p className="home-feed__end">You've reached the end</p>
        )}
      </div>
    </div>
  );
}
