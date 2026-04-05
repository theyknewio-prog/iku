/**
 * scripts/generate-og-image.mjs — render the magnificent OG image for social embeds
 *
 * Outputs public/og-default.png at 1200×630 (standard OG dimensions)
 * Aesthetic: vaporwave + anime, SFW but sexy, makes people click
 */

import sharp from "sharp";
import { writeFile } from "fs/promises";

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Deep purple vaporwave background -->
    <linearGradient id="bbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#0a0514"/>
      <stop offset="35%"  stop-color="#1a0b2e"/>
      <stop offset="65%"  stop-color="#2d1b4e"/>
      <stop offset="100%" stop-color="#4a1a5e"/>
    </linearGradient>

    <!-- Sunset circle gradient -->
    <linearGradient id="sunset" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#fde047"/>
      <stop offset="25%"  stop-color="#fbbf24"/>
      <stop offset="55%"  stop-color="#ff6b9d"/>
      <stop offset="85%"  stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>

    <!-- Pink neon for main title -->
    <linearGradient id="pinkNeon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#ff4785"/>
      <stop offset="40%" stop-color="#ff6b9d"/>
      <stop offset="80%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>

    <!-- Glows -->
    <filter id="bigGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="50"/>
    </filter>
    <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
      <feComposite in2="SourceGraphic" operator="over"/>
    </filter>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bbg)"/>

  <!-- Ambient glow orbs -->
  <circle cx="200" cy="150" r="200" fill="#ff6b9d" opacity="0.25" filter="url(#bigGlow)"/>
  <circle cx="1000" cy="500" r="240" fill="#c084fc" opacity="0.22" filter="url(#bigGlow)"/>
  <circle cx="900" cy="120" r="160" fill="#67e8f9" opacity="0.20" filter="url(#bigGlow)"/>

  <!-- Huge katakana イク as atmospheric background -->
  <text x="600" y="520" text-anchor="middle"
        font-family="'Noto Sans JP','Yu Gothic','Meiryo',sans-serif"
        font-weight="900" font-size="500" fill="#ffffff" opacity="0.04"
        letter-spacing="20">イク</text>

  <!-- Sunset sun (lower, smaller — doesn't overlap the tagline) -->
  <circle cx="600" cy="555" r="170" fill="url(#sunset)" opacity="0.25" filter="url(#bigGlow)"/>
  <circle cx="600" cy="555" r="140" fill="url(#sunset)" opacity="0.50"/>
  <circle cx="600" cy="555" r="105" fill="url(#sunset)" opacity="0.80"/>

  <!-- Horizon cut line (dark floor area) -->
  <rect x="0" y="510" width="1200" height="120" fill="#0a0514" opacity="0.45"/>

  <!-- Retro perspective grid (vaporwave floor) -->
  <g stroke="#ff6b9d" stroke-width="2" opacity="0.45">
    <line x1="0"    y1="630" x2="600" y2="510"/>
    <line x1="150"  y1="630" x2="600" y2="510"/>
    <line x1="300"  y1="630" x2="600" y2="510"/>
    <line x1="450"  y1="630" x2="600" y2="510"/>
    <line x1="600"  y1="630" x2="600" y2="510"/>
    <line x1="750"  y1="630" x2="600" y2="510"/>
    <line x1="900"  y1="630" x2="600" y2="510"/>
    <line x1="1050" y1="630" x2="600" y2="510"/>
    <line x1="1200" y1="630" x2="600" y2="510"/>
  </g>
  <g stroke="#ff6b9d" opacity="0.4">
    <line x1="0" y1="535" x2="1200" y2="535" stroke-width="1.2"/>
    <line x1="0" y1="560" x2="1200" y2="560" stroke-width="1.5"/>
    <line x1="0" y1="590" x2="1200" y2="590" stroke-width="1.8"/>
    <line x1="0" y1="620" x2="1200" y2="620" stroke-width="2.2"/>
  </g>

  <!-- Top-left ornaments -->
  <text x="80"  y="100" font-size="56" fill="#ff6b9d" opacity="0.95">✧</text>
  <text x="150" y="170" font-size="32" fill="#67e8f9" opacity="0.85">✦</text>
  <text x="110" y="230" font-size="26" fill="#ffffff" opacity="0.7">★</text>

  <!-- Top-right ornaments -->
  <text x="1090" y="110" font-size="52" fill="#c084fc" opacity="0.95">✧</text>
  <text x="1020" y="180" font-size="34" fill="#ff6b9d" opacity="0.9">♡</text>
  <text x="1110" y="240" font-size="28" fill="#67e8f9" opacity="0.8">✦</text>

  <!-- MAIN TITLE: iku.gg with layered glow -->
  <!-- Shadow glow layer -->
  <text x="600" y="285" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="200"
        fill="url(#pinkNeon)" opacity="0.9"
        letter-spacing="-6"
        filter="url(#neonGlow)">iku.gg</text>
  <!-- Solid text layer -->
  <text x="600" y="285" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="200"
        fill="#ffffff"
        letter-spacing="-6">iku.gg</text>

  <!-- Tagline -->
  <text x="600" y="355" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="800" font-size="38"
        fill="#ffffff" opacity="0.98"
        letter-spacing="1">
    353,000+ animated hentai · free · no signup
  </text>

  <!-- Subline with hearts -->
  <text x="600" y="400" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="700" font-size="26"
        fill="#ff6b9d" opacity="0.95"
        letter-spacing="3">
    ♡  the biggest animated hentai library on the web  ♡
  </text>

  <!-- Bottom-left heart -->
  <text x="80"  y="590" font-size="34" fill="#ff6b9d" opacity="0.8">♡</text>
  <text x="125" y="605" font-size="22" fill="#67e8f9" opacity="0.7">✦</text>

  <!-- Bottom-right heart -->
  <text x="1100" y="590" font-size="34" fill="#c084fc" opacity="0.8">✧</text>
  <text x="1140" y="605" font-size="22" fill="#ff6b9d" opacity="0.7">♡</text>
</svg>`;

async function run() {
  console.log("🎨 rendering og-default.png (1200×630)");
  const png = await sharp(Buffer.from(SVG)).resize(1200, 630).png({ quality: 95 }).toBuffer();
  await writeFile("public/og-default.png", png);
  console.log(`   ${png.length} bytes → public/og-default.png`);
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
