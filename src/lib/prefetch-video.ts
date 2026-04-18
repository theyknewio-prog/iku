/**
 * prefetch-video.ts — Client-side helper to warm the resolved URL cache
 * on hover, so clicking a card feels instant.
 *
 * Usage (in a "use client" component):
 *   onMouseEnter={() => prefetchVideoUrl(slug)}
 *
 * Strategy:
 *   - Only triggers for sources that need resolution (rule34video, WP sites)
 *   - Debounced to 200ms to avoid spamming on fast mouse movement
 *   - Deduplicates in-flight requests so hovering the same card twice
 *     never fires a second fetch
 *   - Fire-and-forget: we don't care about the result, we just want the
 *     /api/resolve-video cache to be warm by the time the user clicks
 */

// Slugs that need client-side resolution → page URL they correspond to
function getResolvePageUrl(slug: string): string | null {
  // rule34video: r34v-{id}-{title-slug}
  const r34v = slug.match(/^r34v-(\d+)-(.+)$/);
  if (r34v) {
    return `https://rule34video.com/videos/${r34v[1]}/${r34v[2]}/`;
  }

  // WP sites — each has its own prefix and base URL
  const wpPrefixes: Record<string, string> = {
    hmm: "https://hentaimama.io/",
    htv: "https://hentai.tv/hentai/",
    aid: "https://animeidhentai.com/",
    wh: "https://watchhentai.net/",
    hw: "https://hentaiworld.tv/",
    hg: "https://hentaigasm.com/",
  };
  // hentaicity uses no standard prefix we track here — the page URL lives
  // in the DB (page_url column). Hover prefetch skips these — falls back
  // to the normal on-click resolve.
  for (const [prefix, base] of Object.entries(wpPrefixes)) {
    if (slug.startsWith(`${prefix}-`)) {
      // We don't reliably know the slug suffix structure for every WP site
      // from the client, so we skip prefetch for WP. The on-click resolve
      // still works — hover prefetch is a nice-to-have, not required.
      void base;
      return null;
    }
  }

  return null;
}

// In-flight dedup
const inflight = new Set<string>();
// Completed URLs (avoid re-firing)
const completed = new Set<string>();

// Debounce timer per slug
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function prefetchVideoUrl(slug: string): void {
  if (typeof window === "undefined") return;
  if (completed.has(slug) || inflight.has(slug)) return;

  const pageUrl = getResolvePageUrl(slug);
  if (!pageUrl) return;

  // Debounce — only fire if the user actually dwells on the card
  const existing = timers.get(slug);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(slug);
    if (completed.has(slug) || inflight.has(slug)) return;
    inflight.add(slug);
    fetch(`/api/resolve-video?url=${encodeURIComponent(pageUrl)}`, {
      priority: "low",
    } as RequestInit)
      .then(() => {
        completed.add(slug);
      })
      .catch(() => {
        // Best-effort. Silent failure.
      })
      .finally(() => {
        inflight.delete(slug);
      });
  }, 200);

  timers.set(slug, timer);
}

export function cancelPrefetch(slug: string): void {
  const existing = timers.get(slug);
  if (existing) {
    clearTimeout(existing);
    timers.delete(slug);
  }
}
