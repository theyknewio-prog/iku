"use client";

import { useRef, useCallback } from "react";

export type DoubleTapSide = "left" | "right" | null;

interface DoubleTapHandlers {
  onDoubleTap: (side: DoubleTapSide) => void;
  onSingleTap?: () => void;
}

/**
 * Returns an onClick handler that distinguishes single tap from double tap.
 * A second tap within 300ms on the same side triggers onDoubleTap.
 * Otherwise onSingleTap fires after the 300ms window expires.
 */
export function useDoubleTap({ onDoubleTap, onSingleTap }: DoubleTapHandlers) {
  const lastTapTime = useRef<number>(0);
  const lastSide = useRef<DoubleTapSide>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const side: DoubleTapSide = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
      const now = Date.now();
      const delta = now - lastTapTime.current;

      if (delta < 300 && lastSide.current === side) {
        // Double tap — cancel pending single-tap
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastTapTime.current = 0;
        lastSide.current = null;
        onDoubleTap(side);
      } else {
        // First tap — schedule single tap
        lastTapTime.current = now;
        lastSide.current = side;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onSingleTap?.();
        }, 300);
      }
    },
    [onDoubleTap, onSingleTap]
  );

  return { handleClick };
}
