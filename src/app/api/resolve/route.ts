import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const PROXY_URL = process.env.PROXY_URL || "http://10.0.0.1:3001";
const limiter = createRateLimiter({ name: "resolve", max: 20, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
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
