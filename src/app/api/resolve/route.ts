import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// V10 (security audit 2026-04-23): previously fell back to a Docker-
// network IP (`http://10.0.0.1:3001`) when PROXY_URL was unset, opening
// a SSRF probe path toward Coolify's internal services. Fail closed now:
// if PROXY_URL is missing we return 503 instead of defaulting.
const PROXY_URL = process.env.PROXY_URL ?? "";
const limiter = createRateLimiter({
  name: "resolve",
  max: 20,
  windowMs: 60_000,
});

export async function GET(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  if (!PROXY_URL) {
    return NextResponse.json(
      { error: "resolver not configured" },
      { status: 503 },
    );
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
    const res = await fetch(
      `${PROXY_URL}/resolve?slug=${encodeURIComponent(slug)}`,
    );
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json({ error: "failed to resolve" }, { status: 500 });
  }
}
