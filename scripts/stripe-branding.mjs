/**
 * scripts/stripe-branding.mjs
 *
 * Generates the iku.gg logo + icon as PNG files, uploads them to Stripe
 * via the Files API, and sets them as the account branding (used on the
 * Checkout and customer portal pages).
 *
 * Outputs:
 *   public/iku-logo.png  (wide logo, ~600×150, for Checkout header)
 *   public/iku-icon.png  (square icon, 512×512, for Checkout + portal avatar)
 *
 * ENV:
 *   STRIPE_SECRET_KEY
 */

import sharp from "sharp";
import Stripe from "stripe";
import { writeFile } from "fs/promises";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: "2025-09-30.clover" });

// ─── Wide logo (~600×150) — used in Checkout header ─────────────
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150" viewBox="0 0 600 150">
  <defs>
    <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="50%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="600" height="150" fill="#ffffff"/>
  <text x="300" y="105" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="100"
        fill="url(#pink)"
        letter-spacing="-3">iku.gg</text>
  <text x="510" y="55" font-size="32" fill="#ff6b9d">✨</text>
</svg>`;

// ─── Square icon (512×512) — used for account avatar ─────────────
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

async function render(svg, w, h) {
  return sharp(Buffer.from(svg)).resize(w, h).png().toBuffer();
}

async function run() {
  console.log("🎨 Generating Stripe branding assets");

  const logo = await render(LOGO_SVG, 600, 150);
  const icon = await render(ICON_SVG, 512, 512);

  await writeFile("public/iku-logo.png", logo);
  await writeFile("public/iku-icon.png", icon);
  console.log(`  + public/iku-logo.png (${logo.length} bytes)`);
  console.log(`  + public/iku-icon.png (${icon.length} bytes)`);

  console.log("\n📤 Uploading to Stripe Files API (via multipart)");

  // Stripe File uploads use files.stripe.com (separate endpoint), not api.stripe.com
  async function uploadFile(buffer, filename, purpose) {
    const fd = new FormData();
    fd.append("file", new Blob([buffer], { type: "image/png" }), filename);
    fd.append("purpose", purpose);
    const res = await fetch("https://files.stripe.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
  }

  const logoFile = await uploadFile(logo, "iku-logo.png", "business_logo");
  console.log(`  ✓ logo uploaded: ${logoFile.id}`);

  const iconFile = await uploadFile(icon, "iku-icon.png", "business_icon");
  console.log(`  ✓ icon uploaded: ${iconFile.id}`);

  console.log("\n⚙️  Updating account branding");

  const account = await stripe.accounts.retrieve();
  const updated = await stripe.accounts.update(account.id, {
    settings: {
      branding: {
        logo: logoFile.id,
        icon: iconFile.id,
        primary_color: "#ff6b9d",
        secondary_color: "#c084fc",
      },
    },
  });
  console.log(`  ✓ branding set on account ${updated.id}`);
  console.log(`    primary: ${updated.settings?.branding?.primary_color}`);
  console.log(`    secondary: ${updated.settings?.branding?.secondary_color}`);

  console.log(
    "\n✨ Done — Checkout will now show the iku.gg logo + pink colors",
  );
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
