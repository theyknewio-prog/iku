#!/usr/bin/env node
/**
 * One-shot Telegram recap for Sab — overnight 2026-04-17 → 2026-04-18.
 * Using HTML parse_mode to avoid MarkdownV2 escape hell.
 */

const TOKEN =
  process.env.BOT_TOKEN || "8428448598:AAFwli73qAOBXrhMYqAGLfgpBjeM5M5Ehkw";
const CHAT_ID = "5617056258";

const MSG = `🌙 <b>Recap overnight iku.gg — 2026-04-18</b>

⚡ <b>Gros leak de revenus fixé (le plus gros de la nuit)</b>
La sim 20 personas a révélé des TTFB de <b>10 à 18s</b> sur /hentai, /3d, /tag/*, /series/*, /character/*. Origine : le planner PG choisissait un "Incremental Sort over idx_videos_score" et scannait 362K lignes au lieu d'utiliser les GIN indexes sur tags/characters/copyrights. Conséquence silencieuse : Googlebot + long-tail users bounçaient à ~95%. Perte estimée 30-40% des impressions ads.

✅ <b>Fix commité + déployé (commits <code>5fe6155</code> + <code>ec3cbfe</code>)</b>
— Rewrite CTE UNION MATERIALIZED sur <code>_getVideos</code> → 130× plus rapide (14.3s → 107ms sur /series/naruto au bench direct PG)
— <code>_countVideos</code> protégé par <code>SET LOCAL statement_timeout = 3s</code> + fallback <code>reltuples</code> (estime plutôt que timeout)
— Warmup cron <code>/etc/cron.d/iku-warmup</code> corrigé : les slugs <code>large-breasts</code>/<code>big-breasts</code>/<code>long-hair</code> étaient hyphenés alors que la DB a des underscores → zéro hit réel. Maintenant aligné.

📊 <b>Benchmark post-deploy (prod live)</b>
<pre>/tag/large_breasts       3.4s → 0.14s (24×)
/series/naruto           1.1s → 0.31s
/series/dead-or-alive    2.0s → 0.69s
/hentai                  0.82s warm
/3d                      0.98s warm
/tag/animated            1.59s warm
/tag/1girl               1.24s warm
/character/marie-rose    1.75s warm
/trending                0.35s warm
/new                     0.15s warm</pre>

🔧 <b>Autres wins de la nuit</b>
— Ads sweep via Playwright : ExoClick + HentaiPros + Adsterra fill correctement sur home + watch (mobile + desktop)
— Sim 20 personas : mobile + desktop + 5 GEOs + comportements différents → data stockée pour réutilisation
— CTE pattern documenté dans <code>src/lib/content.ts</code> avec le why (sinon le prochain qui touche à la query risque de revert)

⚠️ <b>Still blocking toi</b>
1. <b>API keys rotées</b> pour ExoClick + Adsterra → pour que je pull le revenue trend 14j (tâches #2 + #12)
2. Décision sur partenaires supplémentaires : JuicyAds + TrafficJunky prêts à signup, je peux le faire autonomly si tu valides (tâche #11)

GG. La nuit a servi 💪`;

async function send() {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: MSG,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const j = await res.json();
  console.log(JSON.stringify(j, null, 2));
  if (!j.ok) process.exit(1);
}

send().catch((e) => {
  console.error(e);
  process.exit(1);
});
