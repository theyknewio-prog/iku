import { NextRequest, NextResponse } from "next/server";

const PROXY_URL = "http://127.0.0.1:3001";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
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
