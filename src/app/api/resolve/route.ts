import { NextRequest, NextResponse } from "next/server";

const PROXY_URL = process.env.PROXY_URL || "http://10.0.0.1:3001";

// Rate limit: 20 requests/min per IP
// Map is capped at 10k entries to prevent unbounded growth under attack.
const RATE_LIMIT_MAX_ENTRIES = 10_000;
const resolveRateLimit = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of resolveRateLimit) {
    if (now > val.resetAt) resolveRateLimit.delete(key);
  }
  // Hard cap: if cleanup didn't shrink enough, drop oldest entries.
  while (resolveRateLimit.size > RATE_LIMIT_MAX_ENTRIES) {
    const firstKey = resolveRateLimit.keys().next().value;
    if (firstKey === undefined) break;
    resolveRateLimit.delete(firstKey);
  }
}, 5 * 60_000);

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
    || "unknown";
  const now = Date.now();
  const rl = resolveRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 20) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    rl.count++;
  } else {
    resolveRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9][a-z0-9-]{0,200}$/.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const res = await fetch(`${PROXY_URL}/resolve?slug=${encodeURIComponent(slug)}`);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json(
      { error: "failed to resolve" },
      { status: 500 }
    );
  }
}
