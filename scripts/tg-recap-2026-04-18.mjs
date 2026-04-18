#!/usr/bin/env node
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = "5617056258";

const msg = [
  "🔍 Ad CPM diagnostic — nuit 2026-04-18",
  "",
  "Verdict : API ExoClick bloquée pour tout ce qui compte. Dashboard requis.",
  "",
  "Données 14d (réelles)",
  "• ExoClick : $0.51 (82% VAST preroll, reste banners $0.004–0.020 eCPM 💩)",
  "• Adsterra : $0.64 (71% popunder $0.36 eCPM, banners $0.025–0.037)",
  "",
  "⚡ Adsterra rend 16× plus par impression que ExoClick sur même trafic.",
  "",
  "Pourquoi ExoClick banners sont morts",
  'minimum_cpm=$0 sur toutes les zones = accepte bids $0.001. J\'ai testé 11 payloads API différents, tous renvoient 200 "Zone updated." mais ignorent silencieusement. Pareil pour alternate_html et fallback_ads. Seuls name et border persistent.',
  "",
  "À faire sur le dashboard ExoClick (30 min total)",
  "1) Zones → set Minimum CPM : banners $0.05, preroll $1, popunder $0.15, feed interstitiel $0.30",
  "2) Neverblock CNAME activation sur https://neverblock.exads.com",
  "3) Signup JuicyAds + TrafficStars + HilltopAds",
  "",
  "Le doc complet : docs/AD-REVENUE-DIAGNOSTIC-2026-04-18.md avec zones précises + valeurs + projections.",
  "",
  "Lift attendu : $2.50/mo → $10–15/mo (4–6×). Vrai levier = trafic, pas CPM.",
  "",
  "bonne nuit 🌙",
].join("\n");

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text: msg }),
});
console.log(await r.json());
