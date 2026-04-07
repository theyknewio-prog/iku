"use client";

/**
 * CamWidget — Floating Chaturbate affiliate widget (bottom-right corner).
 * - Dismissible per session (sessionStorage)
 * - Hidden for Pro users (body data-pro="1")
 * - Pulse animation on the red live dot
 */

import { useEffect, useState } from "react";

const AFFILIATE_URL =
  "https://chaturbate.com/in/?tour=dT8X&campaign=ikugg&track=default";
const STORAGE_KEY = "iku-cam-widget-dismissed";

export function CamWidget() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip for Pro users
    if (document.body.dataset.pro === "1") return;
    // Skip if already dismissed this session
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* private browsing */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* quota */
    }
    setVisible(false);
  }

  return (
    <div className="cam-widget">
      <a
        href={AFFILIATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="cam-widget__link"
      >
        <span className="cam-widget__dot" aria-hidden />
        <span className="cam-widget__label">Live Cams</span>
      </a>
      <button
        type="button"
        className="cam-widget__close"
        onClick={dismiss}
        aria-label="Dismiss live cams widget"
      >
        &times;
      </button>
    </div>
  );
}
