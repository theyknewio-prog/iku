#!/usr/bin/env node
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT = process.env.TELEGRAM_CHAT_ID ?? "5617056258";
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN must be set in env");
  process.exit(1);
}

const msg = [
  "HilltopAds OK",
  "",
  "Site iku.gg #890489 verifie via meta tag (deploy b9c5436 push).",
  "",
  "5 zones creees + approuvees :",
  "- Popunder          6969665-6969669  (DirectLink)",
  "- Banner 300x250    6969681          (script)",
  "- In-page Push      6969697          (script)",
  "- VAST Preroll      6969713          (VAST URL)",
  "- Banner 300x100    6969733          (script mobile)",
  "",
  "Code d'integration + CSP hosts a whitelister : memoire reference_hilltopads_zones.md",
  "",
  "Pas encore branche en prod. Prochaine etape :",
  "1) Comparer eCPM HilltopAds popunder vs Adsterra ($0.36) sur 48h isole",
  "2) Waterfall VAST : ExoClick → Adsterra → HilltopAds",
  "3) Integrer banner 300x100 en bottom sticky mobile (remplace actuel ?)",
  "",
  "Update : HilltopAds site cree en 'Mainstream' par accident, pas 'Non-Mainstream'. A recreer si CPM faible en adult apres 48h.",
].join("\n");

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text: msg }),
});
console.log(await r.json());
