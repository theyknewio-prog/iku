"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard shortcuts for a <video> element.
 *
 * The optional `onMuteToggle` callback lets the caller route mute/unmute
 * through their own state machine instead of mutating the DOM directly.
 * This matters when the video's `muted` attribute is controlled by React
 * (e.g. `<video muted={muted} />`) — direct DOM mutation races with the
 * next render and can get reverted. See CLAUDE.md silent-bug section.
 */
export function useVideoShortcuts(
  videoRef: { current: HTMLVideoElement | null },
  opts: { onMuteToggle?: () => void } = {},
) {
  // Stable ref to the latest onMuteToggle so the effect below doesn't need
  // to tear down and re-add its keydown listener on every parent render.
  const onMuteToggleRef = useRef(opts.onMuteToggle);
  useEffect(() => {
    onMuteToggleRef.current = opts.onMuteToggle;
  }, [opts.onMuteToggle]);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable)
        return;

      // A11y: don't steal Space / Enter from focused buttons or links. The
      // useVideoShortcuts handler is global (window keydown) and was
      // preventDefault-ing Space even when a tag pill / Save button / Source
      // button had focus — breaking keyboard-only navigation on the watch
      // page. Let native button activation run instead. See ux.md #6.
      if (
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "SELECT" ||
        target.getAttribute("role") === "button" ||
        target.getAttribute("tabindex") === "0"
      ) {
        if (e.key === " " || e.key === "Enter") return;
      }

      const el = videoRef.current;
      if (!el) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          el.paused ? el.play() : el.pause();
          break;

        case "ArrowLeft":
          e.preventDefault();
          el.currentTime = Math.max(0, el.currentTime - 10);
          break;

        case "ArrowRight":
          e.preventDefault();
          el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
          break;

        case "ArrowUp":
          e.preventDefault();
          el.volume = Math.min(1, el.volume + 0.1);
          break;

        case "ArrowDown":
          e.preventDefault();
          el.volume = Math.max(0, el.volume - 0.1);
          break;

        case "f":
        case "F":
          e.preventDefault();
          // Intentional silent failure: fullscreen requires a user gesture.
          // The Space/F keydown IS a user gesture so this usually succeeds,
          // but a cross-origin iframe or permissions-policy deny will reject
          // — nothing we can do except not log on every rejection.
          if (!document.fullscreenElement) {
            el.requestFullscreen().catch(() => {
              /* permission / cross-origin deny */
            });
          } else {
            document.exitFullscreen().catch(() => {
              /* no active fullscreen */
            });
          }
          break;

        case "m":
        case "M":
          e.preventDefault();
          if (onMuteToggleRef.current) {
            onMuteToggleRef.current();
          } else {
            el.muted = !el.muted;
          }
          break;

        default:
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const pct = parseInt(e.key, 10) * 0.1;
            el.currentTime = (el.duration || 0) * pct;
          }
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [videoRef]);
}
