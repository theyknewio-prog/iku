"use client";

import { useEffect } from "react";

export function useVideoShortcuts(
  videoRef: { current: HTMLVideoElement | null }
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

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
          if (!document.fullscreenElement) {
            el.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;

        case "m":
        case "M":
          e.preventDefault();
          el.muted = !el.muted;
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
