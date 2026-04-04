"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import Image from "next/image";
import { useVideoShortcuts } from "@/hooks/useVideoShortcuts";
import { useDoubleTap } from "@/hooks/useDoubleTap";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

interface RelatedVideo {
  slug: string;
  thumbnail: string;
  title: string;
}

interface WatchPlayerProps {
  src: string;
  poster?: string;
  /** For rule34video: page URL to resolve via /api/resolve-video */
  resolveUrl?: string;
  relatedVideos?: RelatedVideo[];
}

interface SeekOverlay {
  side: "left" | "right";
  id: number;
}

interface HeartBurst {
  x: number;
  y: number;
  id: number;
}

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────
   SVG Icons
───────────────────────────────────────────────────────────── */

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

function IconVolumeFull() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function IconVolumeSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function IconVolumeMuted() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function IconExitFullscreen() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

function IconPiP() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 11h-8v6h8v-6zm4 10V3H1v18h22zm-2-1.98H3V4.97h18v14.05z" />
    </svg>
  );
}

function IconTheater() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z" />
    </svg>
  );
}

function IconLoop() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      style={{ animation: "wp-spin 0.8s linear infinite" }}
    >
      <circle cx="12" cy="12" r="10" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function IconReplay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   ControlBtn
───────────────────────────────────────────────────────────── */

function ControlBtn({
  onClick,
  label,
  children,
  active,
  activeColor,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  activeColor?: string;
}) {
  const color = active ? (activeColor ?? "#e8467c") : "#fff";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color,
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        flexShrink: 0,
        transition: "transform 0.15s ease, color 0.15s ease",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#e8467c";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.color = color;
      }}
    >
      <div style={{ width: 20, height: 20 }}>{children}</div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */

const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

/* ─────────────────────────────────────────────────────────────
   WatchPlayer
───────────────────────────────────────────────────────────── */

export function WatchPlayer({ src, poster, resolveUrl, relatedVideos }: WatchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmuteHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Resolved video URL (for sources like rule34video with temp URLs) */
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (src || !resolveUrl) return;
    let cancelled = false;
    setResolving(true);
    fetch(`/api/resolve-video?url=${encodeURIComponent(resolveUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.videoUrl) setResolvedSrc(data.videoUrl);
        else if (!cancelled) setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [src, resolveUrl]);

  /* ── Playback state ────────────────────────────────────── */
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [volumeSliderOpen, setVolumeSliderOpen] = useState(false);

  /* ── Feature 1: Loop toggle ────────────────────────────── */
  const [looping, setLooping] = useState(true);
  const toggleLoop = useCallback(() => { setLooping((l) => !l); }, []);

  /* ── Feature 2: Tap-to-unmute hint ────────────────────── */
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);

  useEffect(() => {
    unmuteHintTimerRef.current = setTimeout(() => setShowUnmuteHint(false), 3000);
    return () => {
      if (unmuteHintTimerRef.current) clearTimeout(unmuteHintTimerRef.current);
    };
  }, []);

  const handleUnmuteClick = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = volume || 0.5;
    // Update state immediately — otherwise React re-renders with the
    // stale `muted={true}` prop and re-mutes before volumechange catches up.
    setMuted(false);
    setVolume(v.volume);
    // Re-trigger play to satisfy browser autoplay policy for unmuting
    v.play().catch(() => {});
    setShowUnmuteHint(false);
    if (unmuteHintTimerRef.current) clearTimeout(unmuteHintTimerRef.current);
  }, [volume]);

  /* ── Feature 3: End-of-video overlay + countdown ───────── */
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleReplay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    clearCountdown();
    setEnded(false);
    setCountdown(5);
    v.currentTime = 0;
    v.play();
  }, [clearCountdown]);

  const handleCancelAutoplay = useCallback(() => {
    clearCountdown();
    setEnded(false);
    setCountdown(5);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play();
    }
  }, [clearCountdown]);

  const handleEnded = useCallback(() => {
    if (looping) return; // video loops naturally, onEnded won't fire when loop=true, but guard anyway
    if (relatedVideos && relatedVideos.length > 0) {
      setEnded(true);
      setCountdown(5);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            window.location.href = `/watch/${relatedVideos[0].slug}`;
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
  }, [looping, relatedVideos]);

  /* ── Feature 4: Mobile volume gesture (left-side vertical swipe) */
  const touchStartRef = useRef<{ x: number; y: number; isLeftSide: boolean; isVolumeGesture: boolean }>({
    x: 0, y: 0, isLeftSide: false, isVolumeGesture: false,
  });
  const [volumeGestureLabel, setVolumeGestureLabel] = useState<string | null>(null);
  const volumeLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showVolumeLabel = useCallback((vol: number) => {
    setVolumeGestureLabel(`Vol ${Math.round(vol * 100)}%`);
    if (volumeLabelTimerRef.current) clearTimeout(volumeLabelTimerRef.current);
    volumeLabelTimerRef.current = setTimeout(() => setVolumeGestureLabel(null), 1200);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const isLeftSide = touch.clientX - rect.left < rect.width / 2;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isLeftSide,
      isVolumeGesture: false,
    };
    // Always show controls on touch
    showControls();
  }, []); // showControls declared below — hoisted via ref pattern; we call it by name after definition

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const ref = touchStartRef.current;
    if (!ref.isLeftSide) return;
    const touch = e.touches[0];
    const deltaY = ref.y - touch.clientY;
    const deltaX = Math.abs(touch.clientX - ref.x);
    // Only treat as volume gesture if vertical movement dominates
    if (Math.abs(deltaY) < 8 && !ref.isVolumeGesture) return;
    if (deltaX > Math.abs(deltaY) && !ref.isVolumeGesture) return;

    ref.isVolumeGesture = true;
    e.stopPropagation();

    const container = containerRef.current;
    const v = videoRef.current;
    if (!container || !v) return;

    const rect = container.getBoundingClientRect();
    // Full player height = 0→1 volume range
    const deltaNorm = deltaY / rect.height;
    const newVol = Math.max(0, Math.min(1, v.volume + deltaNorm * 1.5));
    v.volume = newVol;
    setVolume(newVol);
    if (newVol > 0) {
      v.muted = false;
      setMuted(false);
    }
    touchStartRef.current.y = touch.clientY;
    showVolumeLabel(newVol);
  }, [showVolumeLabel]);

  /* ── Feature 5: Scroll wheel volume ───────────────────── */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const v = videoRef.current;
    if (!v) return;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newVol = Math.max(0, Math.min(1, v.volume + delta));
    v.volume = newVol;
    setVolume(newVol);
    if (newVol > 0) {
      v.muted = false;
      setMuted(false);
    }
  }, []);

  /* ── UI state ──────────────────────────────────────────── */
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekOverlay, setSeekOverlay] = useState<SeekOverlay | null>(null);
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([]);
  const [shareToast, setShareToast] = useState(false);
  const lastClickRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const shareToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekTooltip, setSeekTooltip] = useState<{
    visible: boolean;
    time: number;
    x: number;
  }>({ visible: false, time: 0, x: 0 });

  const [, startTransition] = useTransition();

  /* Keyboard shortcuts (existing hook — delegates to videoRef) */
  useVideoShortcuts(videoRef);

  /* ── Auto-hide controls ────────────────────────────────── */

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  /* ── Fullscreen change ─────────────────────────────────── */

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ── Cleanup timers on unmount ─────────────────────────── */

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (unmuteHintTimerRef.current) clearTimeout(unmuteHintTimerRef.current);
      if (volumeLabelTimerRef.current) clearTimeout(volumeLabelTimerRef.current);
      if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current);
    };
  }, []);

  /* ── Video event callbacks ─────────────────────────────── */

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    scheduleHide();
  }, [scheduleHide]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleWaiting = useCallback(() => setBuffering(true), []);
  const handleCanPlay = useCallback(() => setBuffering(false), []);
  const handleError = useCallback(() => setError(true), []);

  const handleVolumeChange = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setVolume(v.volume);
    setMuted(v.muted);
    // Hide unmute hint once user unmutes
    if (!v.muted) setShowUnmuteHint(false);
  }, []);

  /* ── Control actions ───────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const willUnmute = v.muted;
    v.muted = !v.muted;
    // Update state immediately — otherwise React re-renders with the
    // stale `muted={muted}` prop and re-mutes the video before the
    // `volumechange` event catches up.
    setMuted(v.muted);
    if (willUnmute) {
      // Ensure audible volume when unmuting from mute state.
      if (v.volume === 0) {
        v.volume = 0.5;
        setVolume(0.5);
      }
      setShowUnmuteHint(false);
      // Browser autoplay policy: after unmuting, re-trigger play()
      // so the browser allows audio output on the current user gesture.
      v.play().catch(() => {});
    }
  }, []);

  const handleVolumeSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const val = parseFloat(e.target.value);
      v.volume = val;
      v.muted = val === 0;
      setVolume(val);
      setMuted(val === 0);
      if (val > 0) {
        setShowUnmuteHint(false);
        v.play().catch(() => {});
      }
    },
    []
  );

  const handleSpeedSelect = useCallback((s: Speed) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setSpeedOpen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      /* PiP unsupported or blocked */
    }
  }, []);

  const toggleTheater = useCallback(() => {
    startTransition(() => setTheaterMode((t) => !t));
  }, [startTransition]);

  /* ── Seek overlay (double-tap feedback) ─────────────────── */

  const showSeekOverlay = useCallback((side: "left" | "right") => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    setSeekOverlay({ side, id: Date.now() });
    overlayTimerRef.current = setTimeout(() => setSeekOverlay(null), 700);
  }, []);

  /* ── Heart burst (center double-tap) ─────────────────────── */

  const triggerHeartBurst = useCallback((x: number, y: number) => {
    const burst: HeartBurst = { x, y, id: Date.now() };
    setHeartBursts((prev) => [...prev, burst]);
    setTimeout(() => {
      setHeartBursts((prev) => prev.filter((b) => b.id !== burst.id));
    }, 700);
  }, []);

  /* ── Share handler ────────────────────────────────────────── */

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
    } catch {
      /* User cancelled or API unavailable */
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* Clipboard blocked — silent fail */
    }
    setShareToast(true);
    if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current);
    shareToastTimerRef.current = setTimeout(() => setShareToast(false), 2000);
  }, []);

  /* ── Double-tap: seek ±10s / single-tap: play-pause ─────── */

  const { handleClick: handleVideoClick } = useDoubleTap({
    onDoubleTap: (side) => {
      const v = videoRef.current;
      if (!v || !side) return;
      // Don't fire double-tap seek if a volume gesture was in progress
      if (touchStartRef.current.isVolumeGesture) return;

      // Check if the tap landed in the center third of the player
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const relX = lastClickRef.current.x - rect.left;
        const centerStart = rect.width * 0.3;
        const centerEnd = rect.width * 0.7;
        if (relX >= centerStart && relX <= centerEnd) {
          // Center third — heart burst, no seek
          const relY = lastClickRef.current.y - rect.top;
          triggerHeartBurst(relX, relY);
          return;
        }
      }

      if (side === "left") {
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else {
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
      }
      showSeekOverlay(side);
      showControls();
    },
    onSingleTap: () => {
      if (touchStartRef.current.isVolumeGesture) return;
      togglePlay();
      showControls();
    },
  });

  /* Track click position for center-tap detection */
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      lastClickRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    },
    []
  );

  /* ── Progress bar ─────────────────────────────────────── */

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !isFinite(v.duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  }, []);

  const handleProgressMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const v = videoRef.current;
      if (!bar || !v || !isFinite(v.duration)) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setSeekTooltip({ visible: true, time: ratio * v.duration, x: e.clientX - rect.left });
    },
    []
  );

  const handleProgressMouseLeave = useCallback(() => {
    setSeekTooltip((s) => ({ ...s, visible: false }));
  }, []);

  /* ── Derived ──────────────────────────────────────────── */

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  /* ── Render ───────────────────────────────────────────── */

  return (
    <>
      <style>{`
        @keyframes wp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes wp-fade-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes wp-seek-fade {
          0%   { opacity: 1; transform: scale(1); }
          70%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 0; transform: scale(1.12); }
        }
        @keyframes wp-unmute-fade {
          0%   { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; pointer-events: none; }
        }
        @keyframes wp-vol-label-fade {
          0%   { opacity: 1; transform: translateX(-50%) scale(1); }
          70%  { opacity: 1; transform: translateX(-50%) scale(1.04); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.96); }
        }
        .wp-theater-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.90);
          z-index: 999;
          pointer-events: none;
          animation: wp-fade-in 0.2s ease;
        }
        .wp-range {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .wp-range::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 99px;
          background: rgba(255,255,255,0.22);
        }
        .wp-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          margin-top: -4.5px;
          transition: transform 0.12s ease;
        }
        .wp-range:hover::-webkit-slider-thumb { transform: scale(1.4); }
        .wp-range::-moz-range-track {
          height: 3px;
          border-radius: 99px;
          background: rgba(255,255,255,0.22);
        }
        .wp-range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          border: none;
        }
        .wp-progress-track:hover { height: 6px !important; }
        .wp-end-thumb:hover { opacity: 0.8; }
        @keyframes wp-heart-main {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.3); }
          50%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
        }
        @keyframes wp-heart-burst-0 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(10px, -40px) scale(0.8); }
        }
        @keyframes wp-heart-burst-1 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(-30px, -35px) scale(0.7); }
        }
        @keyframes wp-heart-burst-2 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(28px, -22px) scale(0.9); }
        }
        @keyframes wp-heart-burst-3 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(-22px, 18px) scale(0.6); }
        }
        @keyframes wp-heart-burst-4 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(38px, 12px) scale(0.8); }
        }
        @keyframes wp-heart-burst-5 {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(-14px, -52px) scale(0.7); }
        }
        @keyframes wp-share-toast {
          0%   { opacity: 0; transform: translateX(-50%) translateY(6px); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          75%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wp-seek-indicator,
          .wp-center-play,
          .wp-controls { transition: none !important; animation: none !important; }
        }
      `}</style>

      {theaterMode && <div className="wp-theater-backdrop" aria-hidden="true" />}

      <div
        ref={containerRef}
        onMouseMove={showControls}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClickCapture={handleContainerClick}
        onClick={() => { setSpeedOpen(false); setVolumeSliderOpen(false); }}
        onWheel={handleWheel}
        style={{
          position: theaterMode ? "fixed" : "relative",
          top: theaterMode ? "50%" : undefined,
          left: theaterMode ? 0 : undefined,
          right: theaterMode ? 0 : undefined,
          transform: theaterMode ? "translateY(-50%)" : undefined,
          zIndex: theaterMode ? 1000 : undefined,
          width: "100%",
          maxWidth: theaterMode ? "100vw" : undefined,
          aspectRatio: "16/9",
          background: "#000",
          borderRadius: isFullscreen ? 0 : "var(--radius-lg, 12px)",
          overflow: "hidden",
          cursor: controlsVisible ? "default" : "none",
          userSelect: "none",
        }}
        role="region"
        aria-label="Video player"
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={resolvedSrc || undefined}
          poster={poster}
          autoPlay
          muted={muted}
          loop={looping}
          playsInline
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onVolumeChange={handleVolumeChange}
          onEnded={handleEnded}
          onClick={handleVideoClick}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            cursor: "inherit",
          }}
        />

        {/* ── Feature 2: Tap-to-unmute hint ────────────────── */}
        {showUnmuteHint && muted && (
          <div
            onClick={handleUnmuteClick}
            aria-label="Tap to unmute"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleUnmuteClick(e); }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 7,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(6px)",
              borderRadius: 20,
              padding: "6px 14px",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              animation: "wp-unmute-fade 3s ease forwards",
            }}
          >
            <IconVolumeSmall />
            Tap to unmute
          </div>
        )}

        {/* ── Feature 4: Volume gesture label ─────────────── */}
        {volumeGestureLabel && (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              top: "50%",
              left: "25%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 30,
              pointerEvents: "none",
              animation: "wp-vol-label-fade 1.2s ease forwards",
              zIndex: 4,
              letterSpacing: "0.02em",
            }}
          >
            {volumeGestureLabel}
          </div>
        )}

        {/* Resolving / Buffering spinner */}
        {(buffering || resolving) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <div style={{ width: 44, height: 44, color: "rgba(255,255,255,0.75)" }}>
              <IconSpinner />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              zIndex: 6,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>⚠</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500 }}>
              Video unavailable
            </span>
          </div>
        )}

        {/* Seek overlay (double-tap feedback) */}
        {seekOverlay && (
          <div
            key={seekOverlay.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              [seekOverlay.side === "left" ? "left" : "right"]: "10%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 30,
              pointerEvents: "none",
              animation: "wp-seek-fade 0.7s ease forwards",
              zIndex: 4,
              letterSpacing: "0.02em",
            }}
          >
            {seekOverlay.side === "left" ? "◄◄ 10s" : "10s ►►"}
          </div>
        )}

        {/* Heart burst overlays (center double-tap like) */}
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
            {/* Main heart */}
            <div
              style={{
                position: "absolute",
                color: "#e8467c",
                fontSize: 40,
                lineHeight: 1,
                animation: "wp-heart-main 0.6s ease forwards",
              }}
            >
              ♥
            </div>
            {/* Radiating mini hearts */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  color: "#e8467c",
                  fontSize: 16,
                  lineHeight: 1,
                  opacity: 0.85,
                  animation: `wp-heart-burst-${i} 0.5s ease forwards`,
                }}
              >
                ♥
              </div>
            ))}
          </div>
        ))}

        {/* Share toast */}
        {shareToast && (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              bottom: 64,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(12,12,12,0.92)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 16px",
              borderRadius: 20,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 11,
              animation: "wp-share-toast 2s ease forwards",
              letterSpacing: "0.02em",
            }}
          >
            Link copied!
          </div>
        )}

        {/* Big center play button */}
        {!playing && !buffering && !ended && (
          <button
            className="wp-center-play"
            onClick={togglePlay}
            aria-label="Play"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              zIndex: 3,
              animation: "wp-fade-in 0.18s ease",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow:
                  "0 0 0 2px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.5)",
                transition: "transform 0.15s ease, background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "scale(1.1)";
                el.style.background = "rgba(232,70,124,0.72)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "scale(1)";
                el.style.background = "rgba(0,0,0,0.55)";
              }}
            >
              <div style={{ width: 28, height: 28, marginLeft: 4 }}>
                <IconPlay />
              </div>
            </div>
          </button>
        )}

        {/* ── Feature 3: End-of-video overlay ─────────────── */}
        {ended && !looping && relatedVideos && relatedVideos.length > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              zIndex: 8,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: "24px 16px",
              animation: "wp-fade-in 0.22s ease",
            }}
          >
            {/* Header */}
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                margin: 0,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Up next in{" "}
              <span style={{ color: "#e8467c", fontVariantNumeric: "tabular-nums" }}>
                {countdown}s
              </span>
            </p>

            {/* Related thumbnails grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                width: "100%",
                maxWidth: 480,
              }}
            >
              {relatedVideos.slice(0, 4).map((rv) => (
                <a
                  key={rv.slug}
                  href={`/watch/${rv.slug}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    transition: "border-color 0.15s ease, transform 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e8467c";
                    (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
                  }}
                >
                  <div style={{ position: "relative", aspectRatio: "16/9", width: "100%" }}>
                    <Image
                      src={rv.thumbnail}
                      alt={rv.title}
                      fill
                      sizes="(max-width: 640px) 45vw, 220px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                  </div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.82)",
                      fontSize: 11,
                      fontWeight: 500,
                      margin: 0,
                      padding: "6px 8px",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                    }}
                  >
                    {rv.title}
                  </p>
                </a>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={handleReplay}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 18px",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
              >
                <div style={{ width: 16, height: 16 }}><IconReplay /></div>
                Replay
              </button>
              <button
                onClick={handleCancelAutoplay}
                style={{
                  background: "rgba(232,70,124,0.15)",
                  border: "1px solid rgba(232,70,124,0.4)",
                  borderRadius: 8,
                  color: "#e8467c",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 18px",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,70,124,0.28)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,70,124,0.15)"; }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Always-visible progress bar — sits at the very bottom, never hides */}
        {!ended && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 6,
              padding: "0 0 0 0",
            }}
            onMouseEnter={() => {
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            }}
            onMouseLeave={scheduleHide}
          >
            {/* Timestamp tooltip */}
            {seekTooltip.visible && duration > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: seekTooltip.x,
                  transform: "translateX(-50%)",
                  background: "rgba(10,10,10,0.9)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  letterSpacing: "0.03em",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                {formatTime(seekTooltip.time)}
              </div>
            )}

            {/* Clickable seek area */}
            <div
              ref={progressRef}
              onClick={seek}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
              style={{
                height: 16,
                display: "flex",
                alignItems: "flex-end",
                cursor: "pointer",
              }}
            >
              <div
                className="wp-progress-track"
                style={{
                  position: "relative",
                  width: "100%",
                  height: 3,
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: "99px 99px 0 0",
                  overflow: "hidden",
                  transition: "height 0.12s ease",
                }}
              >
                {/* Buffered */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${bufferedPct}%`,
                    background: "rgba(255,255,255,0.22)",
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
                    width: `${playedPct}%`,
                    background: "#e8467c",
                    borderRadius: 99,
                  }}
                />
                {/* Scrub thumb */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${playedPct}%`,
                    transform: "translate(-50%, -50%)",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#e8467c",
                    boxShadow: "0 0 5px rgba(232,70,124,0.85)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        <div
          className="wp-controls"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
            padding: "40px 12px 18px",
            transition: "opacity 0.28s ease, transform 0.28s ease",
            opacity: controlsVisible && !ended ? 1 : 0,
            transform: controlsVisible && !ended ? "translateY(0)" : "translateY(6px)",
            pointerEvents: controlsVisible && !ended ? "auto" : "none",
            zIndex: 5,
          }}
          onMouseEnter={() => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          }}
          onMouseLeave={scheduleHide}
        >

          {/* Bottom controls row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              minHeight: 36,
            }}
          >
            {/* Play/Pause */}
            <ControlBtn onClick={togglePlay} label={playing ? "Pause" : "Play"}>
              {playing ? <IconPause /> : <IconPlay />}
            </ControlBtn>

            {/* Volume — tap toggles popup slider, long press mutes */}
            <div style={{ position: "relative" }}>
              <ControlBtn onClick={() => setVolumeSliderOpen((o) => !o)} label={muted ? "Unmute" : "Mute"}>
                {muted || volume === 0 ? <IconVolumeMuted /> : <IconVolumeFull />}
              </ControlBtn>
              {volumeSliderOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(12,12,12,0.95)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "14px 10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    zIndex: 10,
                    boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
                    animation: "wp-fade-in 0.15s ease",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                    {Math.round((muted ? 0 : volume) * 100)}%
                  </span>
                  <input
                    className="wp-range wp-range-vertical"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeSlider}
                    aria-label="Volume"
                    style={{
                      writingMode: "vertical-lr",
                      direction: "rtl",
                      width: 28,
                      height: 100,
                    }}
                  />
                  <ControlBtn onClick={() => { toggleMute(); }} label={muted ? "Unmute" : "Mute"}>
                    {muted || volume === 0 ? <IconVolumeMuted /> : <IconVolumeFull />}
                  </ControlBtn>
                </div>
              )}
            </div>

            {/* Time */}
            <span
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: 12,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                marginLeft: 6,
                letterSpacing: "0.01em",
                flexShrink: 0,
              }}
            >
              {formatTime(currentTime)}
              <span style={{ opacity: 0.4, margin: "0 4px" }}>/</span>
              {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Feature 1: Loop toggle — placed before Speed */}
            <ControlBtn
              onClick={toggleLoop}
              label={looping ? "Disable loop" : "Enable loop"}
              active={looping}
            >
              <IconLoop />
            </ControlBtn>

            {/* Speed */}
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeedOpen((o) => !o);
                }}
                aria-label="Playback speed"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "0 8px",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  height: 44,
                  minWidth: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "border-color 0.15s ease",
                }}
              >
                {speed}x
              </button>
              {speedOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    right: 0,
                    background: "rgba(12,12,12,0.97)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    overflow: "hidden",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedSelect(s)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0 18px",
                        height: 44,
                        background:
                          s === speed ? "rgba(232,70,124,0.16)" : "transparent",
                        color:
                          s === speed ? "#e8467c" : "rgba(255,255,255,0.82)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: s === speed ? 700 : 400,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        transition: "background 0.1s ease",
                      }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Share */}
            <ControlBtn onClick={handleShare} label="Share / Copy link">
              <IconShare />
            </ControlBtn>

            {/* PiP (feature-detect at runtime to avoid SSR mismatch) */}
            <PiPButton onClick={togglePiP} />

            {/* Theater */}
            <ControlBtn
              onClick={toggleTheater}
              label={theaterMode ? "Exit theater" : "Theater mode"}
            >
              <IconTheater />
            </ControlBtn>

            {/* Fullscreen */}
            <ControlBtn
              onClick={toggleFullscreen}
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
            </ControlBtn>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   PiP button — rendered only when browser supports it
   Uses a client-side check to avoid SSR attribute mismatch
───────────────────────────────────────────────────────────── */

function PiPButton({ onClick }: { onClick: () => void }) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        document.pictureInPictureEnabled
    );
  }, []);

  if (!supported) return null;

  return (
    <ControlBtn onClick={onClick} label="Picture in Picture">
      <IconPiP />
    </ControlBtn>
  );
}
