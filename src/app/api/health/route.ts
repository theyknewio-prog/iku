import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// V12 (security audit 2026-04-23): uptime + heap used to be exposed to
// any caller. Fingerprinted deploy windows + OOM proximity. Detailed
// metrics are now gated behind HEALTH_TOKEN (set in Coolify env, used by
// our internal monitoring only). Unauth'd callers get a bare "ok" which
// is enough for Cloudflare / Coolify health checks.

const limiter = createRateLimiter({
  name: "health",
  max: 60,
  windowMs: 60_000,
});

export async function GET(request: NextRequest) {
  if (limiter.consume(getClientIp(request))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const ok =
    process.env.HEALTH_TOKEN && token && token === process.env.HEALTH_TOKEN;

  if (!ok) {
    return NextResponse.json({ status: "ok" });
  }

  const memUsage = process.memoryUsage();
  return NextResponse.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
}
