import { headers } from "next/headers";

const BOT_UA =
  /bot|crawl|slurp|spider|mediapartners|duckduckgo|yandex|baidu|bing|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discordbot|applebot|petalbot|semrushbot|ahrefsbot|mj12bot|seznambot|rogerbot/i;

export async function isLikelyBot(): Promise<boolean> {
  const h = await headers();
  const ua = h.get("user-agent") || "";
  return BOT_UA.test(ua);
}
