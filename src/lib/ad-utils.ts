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
    'script[src*="magsrv.com/ad-provider.js"]'
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
 */
export function insertExoClickZone(
  container: HTMLElement,
  zoneId: string,
  insertedRef: { current: boolean }
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
}
