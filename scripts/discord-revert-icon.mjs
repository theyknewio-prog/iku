/**
 * Revert the Discord server icon to the v1 simple gradient version
 * (the "iku" text on pink→purple gradient that matches the site logo).
 */

import sharp from "sharp";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) { console.error("Missing env"); process.exit(1); }

const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="50%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <circle cx="128" cy="128" r="80" fill="#ffffff" opacity="0.15" filter="url(#blur)"/>
  <circle cx="400" cy="400" r="100" fill="#ffffff" opacity="0.12" filter="url(#blur)"/>
  <text x="256" y="340" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="240"
        fill="#ffffff"
        letter-spacing="-8">iku</text>
  <text x="420" y="170" font-size="80" fill="#ffffff" opacity="0.9">✨</text>
</svg>`;

const png = await sharp(Buffer.from(ICON_SVG)).resize(512, 512).png().toBuffer();
console.log(`icon: ${png.length} bytes`);

const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bot ${BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    icon: "data:image/png;base64," + png.toString("base64"),
  }),
});
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
console.log("✅ icon reverted to v1");
