#!/usr/bin/env node
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT = process.env.TELEGRAM_CHAT_ID ?? "5617056258";
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in env");
  process.exit(1);
}

const msg = [
  "✅ 3 nouveaux partenaires pub signup",
  "",
  "• JuicyAds — iku.media.gg@gmail.com / ikugg → en review manuelle (24-72h)",
  "• TrafficStars — email verifie, Publisher role selected → admin.trafficstars.com",
  "• HilltopAds — direct access au panel → user.hilltopads.com",
  "",
  "Meme password partout : Gomjabbar33!*",
  "",
  "Zap les deux angles morts :",
  "• ExoClick CPM floors : pas de champ UI dans l'editeur de zone. Ni API ni dashboard. Ferme definitivement.",
  "• NeverBlock : pas un CNAME, c'est un reverse-proxy server-side. Seulement banner/sticky/native/instant. Pas de popunder ni VAST. Notre VAST = 82% du revenu ExoClick → ROI negligeable. Skipped.",
  "",
  "Next step : attendre l'approval JuicyAds pour comparer eCPM vs ExoClick/Adsterra et decider du waterfall.",
  "",
  "Les creds sont en memoire : reference_ad_accounts.md",
].join("\n");

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text: msg }),
});
console.log(await r.json());
