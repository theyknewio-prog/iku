"use client";

/**
 * PostrollAd — 300x250 ad overlay shown after a video ends.
 *
 * Displays for 5 seconds before calling onComplete so the "Up Next"
 * autoplay countdown can proceed. A dismiss button is always visible
 * (unlike pre-roll which has a mandatory 5s lock) because post-rolls
 * feel less intrusive when instantly skippable — this keeps bounce
 * rate low while still delivering an impression.
 *
 * Uses the sidebar300 zone (300x250) which has the highest fill rate.
 * Pro users are passed through immediately.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AD_ZONES } from "@/lib/ad-config";
import { waitForAdProvider } from "@/lib/ad-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any;
  }
}

interface PostrollAdProps {
  onComplete: () => void;
}

const ZONE_ID = AD_ZONES.exoclick.sidebar300;
const DURATION_S = 5;
const LOAD_TIMEOUT_MS = 3000;

export function PostrollAd({ onComplete }: PostrollAdProps) {
  const [secondsLeft, setSecondsLeft] = useState(DURATION_S);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setDismissed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Pro users skip immediately
    if (document.body.dataset.pro === "1") {
      finish();
      return;
    }

    const container = containerRef.current;
    if (container && !insertedRef.current) {
      insertedRef.current = true;
      const ins = document.createElement("ins");
      ins.className = "eas6a97888e2";
      ins.dataset.zoneid = ZONE_ID;
      container.appendChild(ins);
      waitForAdProvider(() => {
        (window.AdProvider = window.AdProvider || []).push({ serve: {} });
      });
    }

    // Auto-dismiss after DURATION_S seconds
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // If the ad doesn't fill within LOAD_TIMEOUT_MS, skip immediately
    loadTimerRef.current = setTimeout(() => {
      const c = containerRef.current;
      if (!c) return;
      const hasContent =
        c.querySelector("iframe") ||
        c.querySelector("img") ||
        c.querySelector("video") ||
        c.querySelector("a");
      if (!hasContent) finish();
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [finish]);

  if (dismissed) return null;

  return (
    <div className="postroll-overlay" aria-label="Advertisement">
      <div className="postroll-label">Ad</div>

      {/* 300x250 ad zone — centered in overlay */}
      <div ref={containerRef} className="postroll-ad-container" />

      {/* Dismiss / countdown button — always visible */}
      <button className="postroll-skip-btn" onClick={finish}>
        {secondsLeft > 0 ? `Skip in ${secondsLeft}s` : "Continue"}
      </button>

      {/* Thin progress bar along the bottom */}
      <div className="postroll-progress">
        <div
          className="postroll-progress__bar"
          style={{
            width: `${((DURATION_S - secondsLeft) / DURATION_S) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
