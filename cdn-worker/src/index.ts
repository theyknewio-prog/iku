/**
 * iku.gg Video CDN Worker
 *
 * Cache-through proxy: serves videos from R2 cache, falls back to origin.
 * First viewer triggers cache-fill, all subsequent viewers get edge-cached.
 *
 * Routes:
 *   GET cdn.iku.gg/v/{slug}          → cached video by slug
 *   GET cdn.iku.gg/stream?url={url}  → cached video by source URL
 *   GET cdn.iku.gg/health            → health check
 *
 * Cache hierarchy:
 *   1. Cloudflare edge cache (automatic, ~30 days for popular content)
 *   2. R2 persistent storage (forever until evicted)
 *   3. Origin fetch (iku.gg/api/video-stream or direct source URL)
 */

interface Env {
  VIDEOS: R2Bucket;
  ORIGIN: string;
}

// Hash a URL to a safe R2 key
function urlToKey(url: string): string {
  // Use a simple hash — crypto.subtle is available in Workers
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  // Also include a readable prefix from the URL for debugging
  const prefix = url
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]/gi, "-")
    .substring(0, 60);
  return `videos/${prefix}-${hex}.mp4`;
}

// Determine content type from URL
function getContentType(url: string): string {
  if (url.includes(".webm")) return "video/webm";
  if (url.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  return "video/mp4";
}

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CACHE_HEADERS });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Route: /stream?url={source_url}
    // The main cache-through endpoint
    if (url.pathname === "/stream") {
      const sourceUrl = url.searchParams.get("url");
      if (!sourceUrl) {
        return new Response("Missing ?url= parameter", { status: 400 });
      }
      return handleStream(request, env, ctx, sourceUrl);
    }

    // Route: /v/{slug} — lookup by slug (future: when we store slug→url mapping)
    if (url.pathname.startsWith("/v/")) {
      const slug = url.pathname.slice(3);
      if (!slug) return new Response("Missing slug", { status: 400 });
      // For now, slug-based lookup requires the URL in a query param
      // Future: store slug→sourceUrl mapping in KV or R2 metadata
      const sourceUrl = url.searchParams.get("url");
      if (!sourceUrl) {
        return new Response("Slug-based lookup not yet implemented. Use /stream?url=", { status: 400 });
      }
      return handleStream(request, env, ctx, sourceUrl);
    }

    return new Response("Not found. Use /stream?url={video_url}", { status: 404 });
  },
};

async function handleStream(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  sourceUrl: string
): Promise<Response> {
  const r2Key = urlToKey(sourceUrl);
  const isRange = request.headers.has("Range");

  // 1. Check R2 cache
  try {
    let r2Object: R2ObjectBody | null;

    if (isRange) {
      // Parse range header for R2
      const rangeHeader = request.headers.get("Range") || "";
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : undefined;
        r2Object = await env.VIDEOS.get(r2Key, {
          range: { offset: start, length: end ? end - start + 1 : undefined },
        });
      } else {
        r2Object = await env.VIDEOS.get(r2Key);
      }
    } else {
      r2Object = await env.VIDEOS.get(r2Key);
    }

    if (r2Object) {
      // Cache HIT — serve from R2
      const headers = new Headers(CACHE_HEADERS);
      headers.set("Content-Type", getContentType(sourceUrl));
      headers.set("Accept-Ranges", "bytes");
      headers.set("X-Cache", "HIT");

      if (r2Object.size !== undefined) {
        if (isRange && r2Object.range) {
          const range = r2Object.range as { offset: number; length: number };
          const totalSize = r2Object.size;
          const start = range.offset;
          const end = start + range.length - 1;
          headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
          headers.set("Content-Length", String(range.length));
          return new Response(r2Object.body, { status: 206, headers });
        } else {
          headers.set("Content-Length", String(r2Object.size));
        }
      }

      return new Response(r2Object.body, { status: 200, headers });
    }
  } catch (e) {
    // R2 error — fall through to origin
    console.error("R2 get error:", e);
  }

  // 2. Cache MISS — fetch from origin
  const isDirectUrl = sourceUrl.startsWith("http") && (
    sourceUrl.includes("rule34.xxx") ||
    sourceUrl.includes("gelbooru.com") ||
    sourceUrl.includes("donmai.us") ||
    sourceUrl.includes("cdn.") ||
    sourceUrl.endsWith(".mp4") ||
    sourceUrl.endsWith(".webm")
  );

  let originUrl: string;
  if (isDirectUrl) {
    // Direct MP4/WebM — fetch straight from source CDN
    originUrl = sourceUrl;
  } else {
    // Needs resolution (Rule34Video, WP) — use our proxy
    originUrl = `${env.ORIGIN}/api/video-stream?url=${encodeURIComponent(sourceUrl)}`;
  }

  try {
    const originResponse = await fetch(originUrl, {
      headers: {
        "User-Agent": "iku-cdn-worker/1.0",
        // Pass range to origin for direct URLs
        ...(isRange && isDirectUrl ? { Range: request.headers.get("Range") || "" } : {}),
      },
    });

    if (!originResponse.ok || !originResponse.body) {
      return new Response(`Origin fetch failed: ${originResponse.status}`, {
        status: 502,
        headers: CACHE_HEADERS,
      });
    }

    // Tee the stream: one copy for the client, one for R2
    const [clientStream, cacheStream] = originResponse.body.tee();

    // Fire-and-forget: store in R2 (only for full responses, not range requests)
    if (!isRange && originResponse.status === 200) {
      ctx.waitUntil(
        env.VIDEOS.put(r2Key, cacheStream, {
          httpMetadata: {
            contentType: getContentType(sourceUrl),
          },
          customMetadata: {
            sourceUrl,
            cachedAt: new Date().toISOString(),
          },
        }).catch((e) => console.error("R2 put error:", e))
      );
    }

    // Return the other stream to the client
    const headers = new Headers(CACHE_HEADERS);
    headers.set("Content-Type", getContentType(sourceUrl));
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Cache", "MISS");

    const contentLength = originResponse.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = originResponse.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(clientStream, {
      status: originResponse.status,
      headers,
    });
  } catch (e) {
    console.error("Origin fetch error:", e);
    return new Response(`CDN error: ${(e as Error).message}`, {
      status: 502,
      headers: CACHE_HEADERS,
    });
  }
}
