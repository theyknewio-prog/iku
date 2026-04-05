/**
 * scripts/discord-assets-v2.mjs — rich anime-themed icon + banner for iku.gg Discord
 *
 * Renders two SVG compositions:
 *   1. Icon 512×512  — heart shape + "iku" text with neon glow
 *   2. Banner 960×540 — vaporwave/anime aesthetic with katakana イク,
 *      sparkles, hearts, grid floor, neon typography
 *
 * Uploads both via PATCH /guilds/{id}.
 */

import sharp from "sharp";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) {
  console.error("Missing env");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const headers = { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return {};
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

// ─── Icon: 512x512 — kawaii heart with "iku" ─────────────────────
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#2d1b4e"/>
      <stop offset="50%" stop-color="#1a0b2e"/>
      <stop offset="100%" stop-color="#0a0514"/>
    </radialGradient>
    <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="50%" stop-color="#ff4785"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#67e8f9"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14"/>
      <feComposite in2="SourceGraphic" operator="over"/>
    </filter>
    <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
  </defs>

  <!-- Background square with round corners -->
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>

  <!-- Glow orbs in corners -->
  <circle cx="80" cy="80" r="120" fill="#ff6b9d" opacity="0.35" filter="url(#softglow)"/>
  <circle cx="440" cy="440" r="140" fill="#c084fc" opacity="0.30" filter="url(#softglow)"/>
  <circle cx="420" cy="100" r="80" fill="#67e8f9" opacity="0.28" filter="url(#softglow)"/>

  <!-- Katakana イク in background (very subtle) -->
  <text x="256" y="360" text-anchor="middle"
        font-family="'Noto Sans JP','Hiragino Kaku Gothic Pro','Yu Gothic','Meiryo',sans-serif"
        font-weight="900" font-size="320" fill="#ffffff" opacity="0.05">イク</text>

  <!-- Heart shape glow (behind text) -->
  <path d="M 256 180
           C 256 150, 220 120, 180 120
           C 140 120, 110 150, 110 200
           C 110 270, 180 330, 256 390
           C 332 330, 402 270, 402 200
           C 402 150, 372 120, 332 120
           C 292 120, 256 150, 256 180 Z"
        fill="url(#pink)" opacity="0.9" filter="url(#glow)"/>

  <!-- Text iku -->
  <text x="256" y="290" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="140"
        fill="#ffffff"
        letter-spacing="-4"
        stroke="#ff6b9d" stroke-width="2">iku</text>

  <!-- Sparkle top-right -->
  <text x="400" y="150" font-size="60" fill="#ffffff" opacity="0.9">✦</text>
  <text x="90" y="420" font-size="44" fill="#ffffff" opacity="0.85">✧</text>
  <text x="380" y="400" font-size="32" fill="#67e8f9" opacity="0.9">★</text>
</svg>`;

// ─── Banner: 960x540 — vaporwave anime aesthetic ──────────────────
const BANNER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0a0514"/>
      <stop offset="40%" stop-color="#1a0b2e"/>
      <stop offset="70%" stop-color="#2d1b4e"/>
      <stop offset="100%" stop-color="#4a1a5e"/>
    </linearGradient>
    <linearGradient id="sunset" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#fbbf24"/>
      <stop offset="30%"  stop-color="#ff6b9d"/>
      <stop offset="70%"  stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <linearGradient id="pinkNeon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#ff4785"/>
      <stop offset="50%" stop-color="#ff6b9d"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <linearGradient id="gridLines" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#ff6b9d" stop-opacity="0"/>
      <stop offset="100%" stop-color="#ff6b9d" stop-opacity="0.6"/>
    </linearGradient>
    <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
      <feComposite in2="SourceGraphic" operator="over"/>
    </filter>
    <filter id="bigGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="960" height="540" fill="url(#bbg)"/>

  <!-- Sun / circle on the horizon -->
  <circle cx="480" cy="380" r="160" fill="url(#sunset)" opacity="0.85" filter="url(#bigGlow)"/>
  <circle cx="480" cy="380" r="130" fill="url(#sunset)" opacity="0.95"/>

  <!-- Horizon cut — bottom half is the "floor" -->
  <rect x="0" y="380" width="960" height="160" fill="#0a0514" opacity="0.55"/>

  <!-- Retro grid floor (perspective lines) -->
  <g stroke="#ff6b9d" stroke-width="1.5" opacity="0.55">
    <line x1="0"   y1="540" x2="480" y2="380"/>
    <line x1="120" y1="540" x2="480" y2="380"/>
    <line x1="240" y1="540" x2="480" y2="380"/>
    <line x1="360" y1="540" x2="480" y2="380"/>
    <line x1="480" y1="540" x2="480" y2="380"/>
    <line x1="600" y1="540" x2="480" y2="380"/>
    <line x1="720" y1="540" x2="480" y2="380"/>
    <line x1="840" y1="540" x2="480" y2="380"/>
    <line x1="960" y1="540" x2="480" y2="380"/>
  </g>
  <g stroke="#ff6b9d" opacity="0.5">
    <line x1="0" y1="400" x2="960" y2="400" stroke-width="1"/>
    <line x1="0" y1="425" x2="960" y2="425" stroke-width="1.2"/>
    <line x1="0" y1="455" x2="960" y2="455" stroke-width="1.4"/>
    <line x1="0" y1="490" x2="960" y2="490" stroke-width="1.6"/>
    <line x1="0" y1="530" x2="960" y2="530" stroke-width="1.8"/>
  </g>

  <!-- Katakana イク huge, semi-transparent behind main title -->
  <text x="480" y="330" text-anchor="middle"
        font-family="'Noto Sans JP','Yu Gothic','Meiryo',sans-serif"
        font-weight="900" font-size="360" fill="#ffffff" opacity="0.06"
        letter-spacing="10">イク</text>

  <!-- Top-left ornament -->
  <text x="60" y="80" font-size="44" fill="#ff6b9d" opacity="0.9">✧</text>
  <text x="120" y="140" font-size="28" fill="#67e8f9" opacity="0.85">✦</text>
  <text x="85" y="195" font-size="22" fill="#ffffff" opacity="0.7">★</text>

  <!-- Top-right ornament -->
  <text x="880" y="90" font-size="40" fill="#c084fc" opacity="0.9">✧</text>
  <text x="820" y="150" font-size="26" fill="#ff6b9d" opacity="0.85">♡</text>
  <text x="900" y="200" font-size="22" fill="#67e8f9" opacity="0.8">✦</text>

  <!-- Main title with glow shadow -->
  <text x="480" y="230" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="150"
        fill="url(#pinkNeon)"
        letter-spacing="-4"
        filter="url(#neonGlow)">iku.gg</text>
  <text x="480" y="230" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="150"
        fill="#ffffff"
        letter-spacing="-4">iku.gg</text>

  <!-- Tagline -->
  <text x="480" y="285" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="700" font-size="26"
        fill="#ffffff" opacity="0.95"
        letter-spacing="1">
    353,000+ animated hentai · free · no signup
  </text>

  <!-- Subtagline with heart -->
  <text x="480" y="320" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="600" font-size="18"
        fill="#ff6b9d" opacity="0.9"
        letter-spacing="2">
    ♡  the biggest animated hentai library on the web  ♡
  </text>

  <!-- Bottom-left ornament -->
  <text x="60" y="510" font-size="26" fill="#ff6b9d" opacity="0.7">♡</text>
  <text x="95" y="525" font-size="18" fill="#67e8f9" opacity="0.6">✦</text>

  <!-- Bottom-right ornament -->
  <text x="880" y="510" font-size="26" fill="#c084fc" opacity="0.7">✧</text>
  <text x="905" y="525" font-size="18" fill="#ff6b9d" opacity="0.6">♡</text>
</svg>`;

function toDataURI(buf) {
  return "data:image/png;base64," + buf.toString("base64");
}

async function render(svg, w, h) {
  return sharp(Buffer.from(svg)).resize(w, h).png().toBuffer();
}

async function run() {
  console.log("🎨 rendering icon (512×512)");
  const icon = await render(ICON_SVG, 512, 512);
  console.log(`   ${icon.length} bytes`);

  console.log("🎨 rendering banner (960×540)");
  const banner = await render(BANNER_SVG, 960, 540);
  console.log(`   ${banner.length} bytes`);

  console.log("📤 uploading icon + banner");
  await api("PATCH", `/guilds/${GUILD_ID}`, {
    icon: toDataURI(icon),
    banner: toDataURI(banner),
  });
  console.log("✅ done");
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
