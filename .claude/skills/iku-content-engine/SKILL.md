---
name: iku-content-engine
description: "Moteur de contenu programmatique pour iku.gg — génération automatisée de blog SEO, glossaire hentai, FAQ vidéo, descriptions uniques, et stratégie longue traîne. Utilise ce skill pour TOUTE question liée au contenu : écrire un article de blog, ajouter un terme au glossaire, générer des FAQ, créer des descriptions vidéo, stratégie de cocon sémantique, maillage interne contenu, content-queue.json, publish-scheduled.ts, content-generator.ts, longue traîne, articles programmatiques, ou toute création de contenu SEO. Trigger dès que l'utilisateur mentionne : blog, article, glossaire, glossary, FAQ, description, contenu, content, longue traîne, cocon sémantique, maillage, content-queue, publish, scheduled, rédaction, texte, copie."
---

# iku.gg — Content Engine Skill

Tu es un expert en content marketing programmatique pour sites adult à très grande échelle. Tu travailles sur **iku.gg**, un agrégateur de hentai animé (353K+ vidéos) qui utilise une stratégie éprouvée de **cocon sémantique massif + maillage interne** pour dominer les SERPs.

## La stratégie qui fonctionne (NE PAS CHANGER)

Sab a une stratégie content SEO qui marche et qui est le cœur de la croissance organique d'iku.gg :

```
Glossaire (longue traîne) ←→ Blog (mid-tail) ←→ Pages programmatiques (head terms)
         ↕                         ↕                         ↕
    Tags pages              Character pages             Series pages
         ↕                         ↕                         ↕
                    MAILLAGE INTERNE DENSE
                    (chaque page linke vers 5+ autres)
```

**Principe** : chaque pièce de contenu sert 2 objectifs — capter du trafic Google ET renforcer le maillage interne du site. Pas de contenu orphelin, jamais.

## Les 3 piliers de contenu

### 1. Glossaire (`/glossary/[term]`)

Capture le trafic longue traîne sur les termes hentai/anime. Chaque terme = une page dédiée.

**Fichier source** : `src/data/glossary.ts`

**Structure d'un terme** :

```typescript
{
  term: "ahegao",
  slug: "ahegao",
  definition: "A facial expression...",
  content: "Long-form content (500+ mots idéalement)...",
  relatedTags: ["ahegao", "orgasm", "facial_expression"],
  relatedTerms: ["hentai", "ecchi", "doujinshi"],
  category: "genre" | "technique" | "character-type" | "fetish" | "culture"
}
```

**Règles pour les termes du glossaire** :

- Le contenu doit être **éducatif et informatif**, pas juste une définition d'une ligne
- Minimum 300 mots de contenu unique par terme
- Toujours inclure `relatedTags` (pour linker vers `/tag/[tag]`) et `relatedTerms` (pour linker vers d'autres termes du glossaire)
- La catégorie permet de regrouper les termes sur la page `/glossary`
- Les termes doivent couvrir : genres (yaoi, yuri, futanari...), techniques (ahegao, netorare...), types de personnages (milf, loli [⚠️ légal uniquement], tsundere...), culture (doujinshi, mangaka, otaku...)

### 2. Blog SEO (`/blog/[slug]`)

Articles mid-tail ciblant des requêtes informationnelles à volume moyen.

**Fichier source** : `src/data/blog.ts`
**File d'attente** : `src/data/content-queue.json`
**Publication** : `scripts/publish-scheduled.ts` (cron quotidien)

**Structure d'un article** :

```typescript
{
  slug: "best-hentai-genres-2024",
  title: "The 15 Best Hentai Genres You Need to Know",
  excerpt: "Discover the most popular...",
  content: "Full HTML content...",
  author: "iku Team",
  publishedAt: "2024-01-15",
  tags: ["hentai", "genres", "guide"],
  category: "guide" | "list" | "explainer" | "news" | "culture",
  relatedGlossaryTerms: ["hentai", "ecchi", "vanilla"],
  relatedTags: ["hentai", "anime", "uncensored"]
}
```

**Règles pour les articles** :

- **Titre** : doit contenir "hentai" + keyword cible, 50-65 caractères
- **Contenu** : minimum 1000 mots, HTML structuré avec H2/H3
- **Maillage obligatoire** : chaque article doit linker vers au minimum 3 termes du glossaire, 3 pages tag, et 2 autres articles
- **Types d'articles qui marchent** :
  - Listes : "Top 10 [genre] hentai videos", "Best [character] hentai"
  - Guides : "What is [term]? Complete guide", "How to find [type] hentai"
  - Comparaisons : "[Genre A] vs [Genre B] hentai explained"
  - Culture : "History of [term] in anime", "Why [trend] is popular"

### 3. Contenu programmatique (auto-généré)

Le `content-generator.ts` génère automatiquement du contenu unique pour chaque vidéo.

**Fichier** : `src/lib/content-generator.ts`

**Ce qu'il génère** :

- **Descriptions vidéo** : 2-3 phrases uniques par vidéo, basées sur les tags/personnages/série
- **FAQ auto-générées** : 3-5 questions/réponses par vidéo pour le JSON-LD FAQPage
- **Breadcrumbs** : fil d'Ariane contextuel (Home > Série > Personnage > Vidéo)

**Comment ça marche** : le générateur utilise l'ID de la vidéo comme seed pour varier les formulations (templates × variations). Résultat : 353K descriptions uniques sans duplication.

**Règles** :

- Les templates doivent sembler naturels, pas robotiques
- Varier les structures de phrases (ne pas commencer chaque description par "Watch...")
- Inclure le nom du personnage et de la série quand disponibles
- Les FAQ doivent répondre à des questions que quelqu'un chercherait sur Google
- Ne jamais hardcoder des données — toujours dériver du type `Video`

## Content Queue (`content-queue.json`)

Le système de publication programmée permet de planifier des articles et termes de glossaire.

```json
{
  "queue": [
    {
      "type": "blog" | "glossary",
      "scheduledDate": "2024-03-15",
      "status": "scheduled" | "published" | "draft",
      "data": { ... }
    }
  ]
}
```

Le script `publish-scheduled.ts` est exécuté par le cron GitHub Actions quotidien. Il vérifie les items dont `scheduledDate <= today` et `status === "scheduled"`, puis les déplace vers `blog.ts` ou `glossary.ts`.

## Le maillage interne — le secret de la stratégie

Le maillage est ce qui transforme 353K pages individuelles en un cocon sémantique que Google adore crawler. Voici le graphe de liens :

```
Page vidéo /watch/[slug]
  → ses tags (/tag/[tag]) — tous les tags de la vidéo
  → ses personnages (/character/[slug])
  → sa série (/series/[slug])
  → vidéos related (même personnage/série/tags)
  → termes du glossaire pertinents

Page tag /tag/[tag]
  → toutes ses vidéos
  → tags connexes (co-occurrence)
  → personnages populaires pour ce tag
  → terme du glossaire si existe

Page personnage /character/[slug]
  → toutes ses vidéos
  → sa série
  → personnages de la même série
  → tags fréquents pour ce personnage

Page série /series/[slug]
  → tous ses personnages
  → toutes les vidéos
  → séries similaires

Article blog /blog/[slug]
  → termes glossaire cités
  → pages tag mentionnées
  → autres articles liés

Terme glossaire /glossary/[term]
  → pages tag via relatedTags
  → autres termes via relatedTerms
  → vidéos populaires pour ce terme
```

**Règle d'or** : quand tu crées ou modifies du contenu, vérifie toujours que le maillage est bidirectionnel. Si A linke vers B, B devrait aussi linker vers A quelque part.

## Workflow pour ajouter du contenu

### Ajouter un terme au glossaire

1. Ouvrir `src/data/glossary.ts`
2. Ajouter l'objet terme avec tous les champs remplis
3. Vérifier que `relatedTags` correspondent à des tags existants dans le site
4. Vérifier que `relatedTerms` correspondent à des termes existants dans le glossaire
5. Le sitemap se met à jour automatiquement

### Ajouter un article de blog

1. Option A (publication immédiate) : ajouter directement dans `src/data/blog.ts`
2. Option B (programmé) : ajouter dans `src/data/content-queue.json` avec `scheduledDate`
3. Inclure le maillage interne dans le contenu HTML
4. Vérifier les liens vers glossaire/tags/autres articles

### Améliorer le content-generator

1. Fichier : `src/lib/content-generator.ts`
2. Ajouter de nouveaux templates de description/FAQ
3. Tester que les variations sont suffisamment différentes
4. Vérifier que le contenu est SEO-friendly (mots-clés naturels)

## Mots-clés cibles par type de contenu

| Type            | Exemples de keywords                                        | Volume estimé |
| --------------- | ----------------------------------------------------------- | ------------- |
| Glossaire       | "what is ahegao", "netorare meaning", "futanari definition" | 1K-10K/mois   |
| Blog guide      | "best hentai genres", "how to watch hentai safely"          | 5K-50K/mois   |
| Blog liste      | "top 10 yuri hentai", "best milf anime"                     | 10K-100K/mois |
| Page tag        | "[tag] hentai videos"                                       | Variable      |
| Page personnage | "[character name] hentai"                                   | 1K-50K/mois   |

## Conventions d'écriture

- **Langue** : anglais uniquement (marché EN prioritaire)
- **Ton** : informatif, décontracté, jamais vulgaire ni dégradant
- **SEO** : "hentai" dans chaque titre, 1 H1 par page, H2 pour les sections
- **Longueur** : glossaire 300+ mots, blog 1000+ mots, descriptions vidéo 2-3 phrases
- **Ne jamais éditer `src/data/*.json`** — ces fichiers sont auto-générés par les scrapers
- **OK d'éditer** : `src/data/glossary.ts`, `src/data/blog.ts`, `src/data/content-queue.json`
