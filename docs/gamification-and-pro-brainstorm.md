# iku.gg — Gamification + Pro subscription brainstorm

_Synthèse de 5 agents spécialisés (strategy, CRO, customer experience, merchandising, community). 2026-04-05._

---

## TL;DR — Le plan en 5 étapes

**Ne pas tout lancer en même temps.** Il faut installer le pipeline de mesure avant tout, puis monétiser (tant que tu as du trafic), puis fidéliser (gamification), puis boucler avec Discord. Ordre imposé par la dépendance aux données :

```
Phase 1 (semaine 1)    Analytics + baseline metrics     [PostHog self-hosted]
Phase 2 (semaine 2-3)  Stripe Pro 4.99€/mois + lifetime [pendant que le trafic est là]
Phase 3 (mois 2)       Gamification — streaks + tiers   [quand cohortes mesurables]
Phase 4 (mois 2-3)     Discord role sync (Pro + tiers)  [boucle site × Discord]
Phase 5 (mois 3+)      Daily drop bot + rituels         [automation retention]
```

Gamification **après** Pro parce que : (1) on a déjà du trafic à monétiser, (2) sans baseline metrics on ne peut pas mesurer si la gamification marche, (3) Stripe peut prendre 1-2 semaines à enabler adult content → autant démarrer maintenant.

---

## Phase 1 — Analytics baseline (semaine 1)

### Pourquoi c'est non-négociable

Sans ces métriques, toutes les décisions qui suivent sont des paris aveugles. Ne pas lancer Pro sans baseline.

### Stack

- **PostHog self-hosted** (pas Google Analytics — GA bannit facilement les sites adult)
- RGPD-friendly, auto-hostable sur le même VPS Hetzner
- Events visuels + funnels + cohort retention

### Métriques à tracker dès J1

| Métrique               | Target  | Benchmark                      |
| ---------------------- | ------- | ------------------------------ |
| D1 retention           | 25-30%  | Industrie tube adult           |
| D7 retention           | 10-15%  | xVideos interne estimé         |
| D30 retention          | 5-8%    | Paid streaming niche           |
| Session avg            | 8-9 min | xVideos 8:26, Pornhub 8:42     |
| Pages/session          | 7-9     | xVideos 8.89                   |
| Anon → Registered      | 3-5%    | Réaliste early stage           |
| Registered → Active J7 | 40%+    | Patreon créateur moyen         |
| Free → Pro             | 2-4%    | Standard adult ad-free premium |
| Churn Pro mensuel      | <8%     | Nebula ~5%                     |

### Events à logger

- `video_view` (threshold 30s), `video_complete` (80%)
- `favorite_add`, `favorite_remove`
- `signup`, `login`, `discord_link`
- `pro_checkout_start`, `pro_purchase`, `pro_cancel`
- `search`, `tag_click`, `character_click`

---

## Phase 2 — Stripe Pro (semaine 2-3)

### ⚠️ Action la plus urgente de la session

**Contacter Stripe support dès maintenant** pour activer le compte en "adult content enabled". Ce n'est pas automatique. Sans ça, le compte sera suspendu au premier paiement adult.

Conditions à respecter :

- Age gate ✅ (déjà en place)
- DMCA policy visible ✅
- 2257 compliance notice ✅
- Content filtering 3 niveaux ✅ (à documenter pour Stripe)
- **Descripteur de paiement neutre** : "IKU GG" ou "IKU MEDIA" (pas "hentai"/"adult")

**Backup obligatoire** : ouvrir un compte **Paxum** ou **Epoch** en parallèle J0. Si Stripe suspend sans préavis (ça arrive), switch en 24h.

**NE JAMAIS** : PayPal. Leur politique adult est beaucoup plus dure que Stripe, les suspensions sont définitives.

### Structure tarifaire

| Plan                  | Prix             | Équivalent/mois | Notes                                              |
| --------------------- | ---------------- | --------------- | -------------------------------------------------- |
| **Mensuel**           | 4.99€            | 4.99€           | Sweet spot (entre Patreon 3€ et Crunchyroll 7.99€) |
| **Annuel**            | 39.99€           | 3.33€           | -33% standard SaaS                                 |
| **Lifetime (launch)** | 69.99€           | ~14 mois        | **Limité 500 spots**, compteur visible             |
| **First month**       | 0.99€ puis 4.99€ | —               | Coupe la friction premier achat                    |

**Pourquoi 4.99€ et pas 3.99€ ?** En-dessous de 4€, perçu comme low-value sur contenu adult. Au-dessus de 5€, seuil cognitif qui allonge la décision. 4.99€ = charm price optimal.

### Features Pro (10 perks)

Rangées par **valeur perçue** pour l'audience :

1. 🚫 **Zero ads** — la base
2. ⬇️ **Download HD** — perk #1 sur tous les sites adult premium
3. ❤️ **Unlimited favorites** (free limité à 50)
4. 📚 **Extended history** — illimité (free = 100)
5. 🎯 **Early access 48h** — nouveautés avant tout le monde
6. 📂 **Playlists privées illimitées**
7. 💎 **Badge Pro** visible sur profil + Discord (rôle auto-assigné)
8. 🎮 **Discord Pro-only channels** — accès `#pro-lounge` + votes features
9. ⚡ **No rate limit** sur search + resolve-video
10. 🏆 **Priority video resolution queue** — clips chargent plus vite

### Offres de lancement (J0→J90)

| Jour | Action           | Message                                         |
| ---- | ---------------- | ----------------------------------------------- |
| J0   | Launch           | 0.99€ first month + lifetime 69.99€ (500 spots) |
| J30  | Push FOMO        | "Derniers 100 lifetimes"                        |
| J60  | Fin lifetimes    | Annuel 29.99€ (2 semaines only)                 |
| J90  | Pricing standard | 4.99€/mois, 39.99€/an, plus de deals            |

### Risques identifiés

- **Chargeback rate** : sites adult = 3-5x plus élevé que normal. >1% → Stripe suspend. Mitiger : 0.99€ limité aux comptes email vérifié + Discord lié.
- **DSA Europe** : si >45M users EU/mois, obligations supplémentaires. Problème futur.
- **SEO vs Stripe** : mots-clés "hentai" dans les meta est OK pour SEO, mais ne jamais les mettre dans le descripteur bancaire.

---

## Phase 3 — Gamification core (mois 2)

### Mécaniques à implémenter (par ROI rétention)

**1. Daily streak (ROI #1 — Duolingo = 3x rétention J30)**

- Flamme sur l'avatar dès J3
- Streak Freeze consommable (2 max, rechargement mensuel) — perte aversion > gain
- Badge "Monthly Devotee" à J30 permanent

**2. Daily quests (Twitch Drops model)**

- 3 quêtes/jour qui prennent 3-5 min total
- Exemples : "Watch 3 clips", "Discover a new character", "Watch a Top Rated clip"
- Reset minuit UTC avec timer visible
- Récompense : points XP + chance de badge

**3. Collection system (Danbooru/AniList)**

- Character collections : "Collect all 12 clips of [X] this week"
- Badges par série/artiste complete
- Pornhub Premium badges series = +18% rétention segment

**4. Tier public visible (badge profile)**

- Apparaît dans les commentaires futurs, profil, Discord
- Vanity = conversion

**5. Video of the Day (Criterion/Mubi model)**

- Une seule vidéo mise en avant par jour (pas un carousel)
- Bonus XP si vue avant minuit
- Singularité = valeur perçue

### Scoring formula

| Action                   | Points |
| ------------------------ | ------ |
| Video view (>30s)        | +2     |
| Video complete (>80%)    | +5     |
| Favorite add             | +8     |
| Daily quest complete     | +15    |
| Video of the Day viewed  | +20    |
| New character discovered | +10    |
| Share click              | +5     |
| Streak 7 days bonus      | +50    |
| Streak 30 days bonus     | +200   |

**Anti-farm** : cap 100 pts/jour sur les vues, pas de cap sur qualité (favorites, quests).

### Tiers (6 niveaux, thème anime)

| Tier | Nom           | Seuil  | Unlock                                                                 |
| ---- | ------------- | ------ | ---------------------------------------------------------------------- |
| T1   | Wanderer      | 0      | Default                                                                |
| T2   | Kouhai        | 200    | Badge profil animé + stats personnelles                                |
| T3   | Senpai        | 1 000  | Border profil coloré + historique 90j + 1 streak freeze supplémentaire |
| T4   | Otaku         | 5 000  | Discord role visible + early access sources + priority resolve         |
| T5   | Waifu Scholar | 15 000 | **-30% sur Pro** + custom avatar border + Curator Picks hebdo          |
| T6   | Hentai Sage   | 50 000 | Badge SAGE animé + VIP Discord + vote sur features + nom dans credits  |

**Pourquoi T5 donne un discount et pas Pro gratuit** : après 15 000 points (semaines d'activité), l'attachement émotionnel est max. Un discount réduit la friction de paiement sans dévaloriser Pro. Mécanique testée par Duolingo Super.

**T3 (Senpai) atteignable en 3-4 semaines** d'usage régulier → motivation visible rapidement. T6 nécessite 6-12 mois → rareté = valeur.

### Hooks "return tomorrow"

- **Streak Freeze** — Duolingo: 500M users, le hook #1
- **Weekend 2x XP** — Habitica: pic de trafic prévisible vendredi-dimanche
- **Character of the Week** — featured personnage lundi, expire dimanche, badge "Week Exclusive"
- **Milestone notif** — "You're 47 pts from Senpai"

### Pièges à éviter

- ❌ Timers agressifs sur les vidéos — +200% bounce rate
- ❌ Points sans utilité perceptible rapide — 70% abandonnent J7
- ❌ Leaderboard public par défaut — suicide sur adult (Danbooru = opt-in)
- ❌ Paywall brutal à un tier — crée du churn
- ❌ Reset mensuel des points — punition perçue

---

## Phase 4 — Discord role sync (mois 2-3)

### Table à créer

```sql
CREATE TABLE user_discord_links (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ
);
```

(Discord OAuth déjà actif → on a déjà le discord_id dans NextAuth, juste à persister.)

### Cron horaire : `scripts/discord-sync-roles.mjs`

Pour chaque user linké :

1. Recalcule le tier (Wanderer → Hentai Sage) depuis user_stats
2. Recalcule le top 100 weekly (rolling 7 jours)
3. Recalcule le streak current
4. PATCH `/guilds/{id}/members/{user}/roles` pour assigner/retirer :
   - Role Pro (si subscription active)
   - Role Tier (selon score)
   - Role 🔥 streak (7j/30j/100j/365j)
   - Role 🏆 Top Fan (top 100 weekly)

### Retire aussi les roles

Le Top Fan bascule d'un user à l'autre chaque semaine → rotation permanente = compétition.

---

## Phase 5 — Automation rituals (mois 3+)

### Daily Drop bot (scheduled)

Bot Discord qui tourne chaque matin :

1. Pick le top clip nouveau des dernières 24h
2. Poste dans `#daily-drop` avec embed riche (thumbnail, titre, link, score)
3. Ping `@Daily Drop` role (opt-in)

### Character of the Week

1. **Vendredi** : bot ouvre un poll avec 5 candidats dans `#vote-cotw`
2. **Lundi** : annonce du gagnant + curation de 10 clips + badge "Week Exclusive"
3. Trafic drive vers `/character/[slug]`

### Weekly Leaderboard

Lundi 9h UTC :

1. Bot calcule top 10 users de la semaine (watchtime + favs + quests)
2. Poste embed dans `#leaderboard`
3. #1 reçoit role "Weekly King/Queen" pour 7 jours
4. Chaque ligne = lien vers le profil public du user

### Tag Roulette (jeudi)

Bot spin un tag aléatoire, annonce dans `#tag-roulette`. 48h pour partager un clip préféré du tag. Plus de reactions = gagnant.

### Watch Party (dimanche)

Ping 1h avant dans `#watch-party-voice`. Bot poste un compte à rebours + timestamps.

### Bots tiers à ajouter

| Bot             | Rôle                                                    | Coût                   |
| --------------- | ------------------------------------------------------- | ---------------------- |
| **Statbot**     | Analytics serveur                                       | Gratuit à petit volume |
| **Simple Poll** | Polls avec images (COTW)                                | Gratuit                |
| **Welcomer**    | Messages bienvenue visuels                              | Gratuit                |
| **Wick**        | Modération NSFW automatique (détection contenu illégal) | Gratuit / Pro 5$/mois  |
| **YAGPDB**      | Automations complexes de roles                          | Gratuit                |

---

## Lifecycle par persona (customer experience)

### Anonymous visitor

- **Signaux** : 2+ vidéos, scroll dans un tag récurrent, retour J+1
- **Trigger** : au 3e pageview, tooltip "Save favorites — 10s"
- **CTA** : "Create free account to save favorites + no interruptions"
- **Jamais** : modal plein écran au premier visit

### Registered free

- **Signaux** : 3+ favoris, tag récurrent, 3 jours/7
- **Trigger email J+1** : "Your watchlist is ready — 5 new clips of [character]"
- **Trigger email J+3** : "You have unwatched clips"

### Engaged daily

- **Signaux** : streak 5+, 10+ favs, 3+ sessions/semaine
- **Trigger** : upgrade proposal exactement au moment de la 3e pub en session
- **CTA** : "Remove all ads forever — 3€/mois. Cancel anytime."

### Pro convert

- **Email de bienvenue 5 min** : liste concrète des perks
- **Pas de upsell 30j**
- **CTA** : "Join Pro channel on Discord"

### Long-term loyal (Pro 3+ mois)

- **iku.gg Wrapped mensuel** (Spotify-style) : "You watched 847 minutes. Top character: X. Rarest tag: Y."
- **+11% renouvellement** selon data Spotify

### Winback

| Jour | Canal             | Message                                          |
| ---- | ----------------- | ------------------------------------------------ |
| J+3  | Push notification | "🔥 12 nouveaux clips de [tag]"                  |
| J+7  | Email             | "[Character] a de nouveaux clips" (personnalisé) |
| J+14 | Email offre       | "1 mois Pro à 1€ — expire dimanche"              |
| J+30 | Email final       | Nouveautés plateforme, pas de discount           |
| J+60 | **Archive**       | Continuer = delivability Gmail cassée            |

### Conversion free → Pro — moments de vérité

1. **Après la 3e pub** (Twitch : 73% des conversions Turbo dans les 60s qui suivent une pub longue)
2. **7e jour de streak** (l'user a investi, craint de perdre)
3. **10 favoris ajoutés** (signal d'investissement plateforme)
4. **Pricing en négatif** : "Tu as vu 47 pubs ce mois. Pro = 0." (+35% conversion vs paywall)
5. **Checkout 45s** via Stripe Payment Links — chaque étape en plus = -15% conv

### NPS

- Post-session : 1 question binaire 👍/👎 (15-20% réponse vs 2% formulaire)
- J+7 post-registration : 2 questions max
- J+1 post-Pro : NPS classique sur 10
- **Max 1 enquête/30 jours** — sinon NPS -8 à -12 points

---

## Décisions à prendre (actionnables)

### Urgent (cette semaine)

- [ ] **Contacter Stripe support** pour enable adult content
- [ ] **Ouvrir Paxum ou Epoch account** en backup
- [ ] Installer PostHog self-hosted sur Hetzner
- [ ] Choisir : **4.99€ confirmé** ou tu veux ajuster le prix ?
- [ ] Choisir : **lifetime 69.99€ limité 500 spots** au lancement ou skip ?

### Important (2 semaines)

- [ ] Créer le schéma `user_stats` (score, streak, longest_streak, last_active, tier, freezes)
- [ ] Branches Stripe webhooks
- [ ] Page `/pricing` + checkout flow
- [ ] Page `/pro` pour showcase les features

### Mois 2

- [ ] Daily quests system
- [ ] Scoring engine + tier progression
- [ ] Discord role sync bot
- [ ] OG tags enrichis sur `/watch/[slug]` (déjà faits mais à verifier pour titres/thumbnails)

---

## Anti-patterns à ne PAS reproduire

1. **Over-monetize Discord** — max 1 promo / 10 messages de valeur
2. **Leaderboard public par défaut** — Danbooru/e621 en opt-in uniquement
3. **Paywall sur feature atteignable gratuitement** — frustration → churn + reviews négatives
4. **Reset mensuel des points** — punition perçue (sauf quests)
5. **Timer overlays pendant la lecture vidéo** — +200% bounce rate sur sites adult testés
6. **PayPal pour adult** — ban définitif garanti
7. **GA4 pour adult** — compte coupé tôt ou tard
8. **Moderator bans fatigués à 3h du matin** — destroy trust permanent
