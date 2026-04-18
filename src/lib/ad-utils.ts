/**
 * ad-utils.ts — Shared utilities for ExoClick ad zone injection.
 *
 * ROOT CAUSE of broken ads:
 * ExoClick's ad-provider.js is loaded with next/script strategy="lazyOnload"
 * (fires after hydration). But ad components mount and call
 * `window.AdProvider.push({ serve: {} })` immediately. If the script hasn't
 * finished loading yet, ExoClick's array-observer has not yet been set up,
 * so the push never triggers a fill.
 *
 * FIX: `serveAdZone()` checks whether the ExoClick script has already
 * bootstrapped (it replaces the array with a real object). If not, it
 * waits for the script load event or polls with exponential backoff.
 * Max wait: 8 seconds — after that we give up (no fill, zone stays empty).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any;
    _adProviderReady?: boolean;
  }
}

const MAX_WAIT_MS = 8000;
const POLL_INTERVAL_MS = 250;

/**
 * Returns true when ExoClick's ad-provider.js has initialized.
 * The script replaces the stub array with a real AdProvider object.
 */
function isAdProviderReady(): boolean {
  const ap = window.AdProvider;
  if (!ap) return false;
  // ExoClick replaces the bootstrap array stub with an object that has a
  // `push` method (it's still callable) but also other keys set by their init.
  // The simplest heuristic: it's ready when it's no longer a plain Array.
  return !Array.isArray(ap);
}

/**
 * Waits until ExoClick's ad-provider.js is initialized, then calls the
 * callback. If it doesn't initialize within MAX_WAIT_MS, calls callback
 * anyway so that the `<ins>` element exists in the DOM for any late init.
 */
export function waitForAdProvider(callback: () => void): void {
  if (typeof window === "undefined") return;

  if (isAdProviderReady()) {
    callback();
    return;
  }

  const startTime = Date.now();

  function poll() {
    if (isAdProviderReady()) {
      callback();
      return;
    }
    if (Date.now() - startTime >= MAX_WAIT_MS) {
      // Timeout — call anyway. The <ins> will be in the DOM for any late init.
      callback();
      return;
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  // Also listen for the script's load event as a fast path
  const scriptEl = document.querySelector<HTMLScriptElement>(
    'script[src*="magsrv.com/ad-provider.js"]',
  );
  if (scriptEl) {
    const onLoad = () => {
      scriptEl.removeEventListener("load", onLoad);
      // Small delay: ExoClick bootstraps synchronously after the script body
      // runs, but next/script appends it dynamically so give one tick.
      setTimeout(callback, 50);
    };
    scriptEl.addEventListener("load", onLoad);
  }

  poll();
}

/**
 * Inserts an ExoClick <ins> zone into `container` and signals the provider.
 * Safe to call multiple times — `insertedRef` tracks whether insertion done.
 *
 * If `fallbackSize` is provided, schedules a no-fill check 5s later:
 * when ExoClick returns no creative (<ins> stays empty, no iframe), the
 * container is replaced by an Adsterra srcdoc iframe of the matching size.
 * This recovers revenue in geos where ExoClick has zero demand (FR/US/UK/CA).
 */
export function insertExoClickZone(
  container: HTMLElement,
  zoneId: string,
  insertedRef: { current: boolean },
  fallbackSize?: "728x90" | "300x250" | "300x600" | "320x50" | "300x50",
): void {
  if (insertedRef.current) return;
  insertedRef.current = true;

  const ins = document.createElement("ins");
  ins.className = "eas6a97888e2";
  ins.dataset.zoneid = zoneId;
  container.appendChild(ins);

  waitForAdProvider(() => {
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  });

  if (fallbackSize) {
    scheduleNoFillFallback(container, ins, fallbackSize);
  }
}

// Adsterra fallback invoke tokens — must match ADSTERRA_SCRIPTS in ad-config.ts
const ADSTERRA_FALLBACK: Record<string, { key: string; w: number; h: number }> =
  {
    "728x90": { key: "5a7f6bdcb73dec1719a9657cd49a2bd0", w: 728, h: 90 },
    "300x250": { key: "b149e9de3cee857db29388ee9ca47054", w: 300, h: 250 },
    "300x600": { key: "ef2e2fad3e1fdae3f74774dac32c0ca5", w: 160, h: 600 },
    "320x50": { key: "f11ddd24aa56b6d650655b4563d67461", w: 320, h: 50 },
    "300x50": { key: "f11ddd24aa56b6d650655b4563d67461", w: 320, h: 50 },
  };

function buildAdsterraSrcDoc(key: string, w: number, h: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions={'key':'${key}','format':'iframe','height':${h},'width':${w},'params':{}};</script><script src="https://www.highperformanceformat.com/${key}/invoke.js"></script></body></html>`;
}

/**
 * Checks 5s after zone insertion whether ExoClick rendered a creative.
 * ExoClick injects an <iframe> inside the <ins> on fill. If no iframe
 * and <ins> has zero dimensions, we consider it a no-fill and swap in
 * an Adsterra srcdoc iframe at the matching size.
 */
function scheduleNoFillFallback(
  container: HTMLElement,
  ins: HTMLElement,
  size: keyof typeof ADSTERRA_FALLBACK,
): void {
  setTimeout(() => {
    if (!container.isConnected) return;
    const hasIframe = !!ins.querySelector("iframe");
    const rect = ins.getBoundingClientRect();
    const filled = hasIframe && rect.width > 0 && rect.height > 0;
    if (filled) return;

    const cfg = ADSTERRA_FALLBACK[size];
    if (!cfg) return;

    const iframe = document.createElement("iframe");
    iframe.title = `ad-fallback-${size}`;
    iframe.width = String(cfg.w);
    iframe.height = String(cfg.h);
    iframe.scrolling = "no";
    iframe.frameBorder = "0";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    iframe.style.cssText =
      "border:none;display:block;margin:0 auto;max-width:100%";
    iframe.srcdoc = buildAdsterraSrcDoc(cfg.key, cfg.w, cfg.h);

    ins.remove();
    container.appendChild(iframe);
  }, 5000);
}
