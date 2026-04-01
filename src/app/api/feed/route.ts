import { NextRequest, NextResponse } from "next/server";

const PROXY_URL = process.env.PROXY_URL || "http://10.0.0.1:3001";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0");

  try {
    const res = await fetch(`${PROXY_URL}/catalog?page=${page}`);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Feed fetch error:", error);
    return NextResponse.json(
      { videos: [], page, error: "failed to fetch catalog" },
      { status: 500 }
    );
  }
}
