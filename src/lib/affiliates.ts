/**
 * affiliates.ts — Master list of AI girlfriend/companion affiliate programs.
 *
 * This is the single source of truth for affiliate data.
 * AffiliateCard, AffiliateRail, and the /go/[slug] route all read from here.
 *
 * Thumbnails point to CrakRevenue's hosted CDN creatives (imglnkx.com).
 * imglnkx is whitelisted in CSP img-src + media-src. Using the network's
 * own creatives means: (a) zero asset upload burden, (b) creatives stay
 * fresh as the network rotates them server-side, (c) visual style matches
 * the routed offer (Smartlink rotates 30+ AI offers behind any /go/* URL).
 *
 * Two CrakRevenue 300x250 creatives are currently in rotation; we alternate
 * across the 8 cards for visual variety. Pull more sizes/themes from the
 * CrakRevenue Creatives library and slot them in here as needed.
 */

// 3 creatives pulled from the AI Smartlink Banners library 2026-05-02:
//   Hentai     — anime/hentai-styled (best for our core audience)
//   Mainstream — realistic AI girlfriend (premium feel)
//   Generic    — neutral fallback
// Rotate across the 8 cards so adjacent rails don't show the same image.
const CRAK_HENTAI_300x250 =
  "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_Hentai-Banners_300250.jpg";
const CRAK_MAINSTREAM_300x250 =
  "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_300250_Mainstream.png";
const CRAK_GENERIC_300x250 =
  "https://www.imglnkx.com/9403/ADV-21652_DESIGN-21652_300250.jpg";

export interface Affiliate {
  slug: string;
  brand: string;
  tagline: string;
  thumbnail: string;
  rating: number;
  badge?: string;
  category: "chat" | "image" | "both";
}

export const AFFILIATES: readonly Affiliate[] = [
  {
    slug: "candy-ai",
    brand: "Candy.AI",
    tagline:
      "Build your perfect AI girlfriend — uncensored roleplay, voice, and photos",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.8,
    badge: "EDITOR'S PICK",
    category: "both",
  },
  {
    slug: "only-waifus",
    brand: "OnlyWaifus.AI",
    tagline:
      "Anime-style waifus that send you pictures and talk back — NSFW unlocked",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.6,
    badge: "BEST FOR HENTAI",
    category: "both",
  },
  {
    slug: "anime-genius",
    brand: "Anime Genius",
    tagline: "Live3D-powered waifu companions with real-time 3D expressions",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "kupid-ai",
    brand: "Kupid.AI",
    tagline: "Ultra-realistic AI partners — chat, images, and audio messages",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.5,
    badge: "MOST REALISTIC",
    category: "both",
  },
  {
    slug: "dream-gf",
    brand: "DreamGF.AI",
    tagline:
      "Design her from scratch — face, body, personality, kinks — and chat now",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.7,
    badge: "FREE TRIAL",
    category: "both",
  },
  {
    slug: "crush-on",
    brand: "CrushOn.AI",
    tagline: "No filters, no limits — explicit AI chat with 2,000+ characters",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.5,
    category: "chat",
  },
  {
    slug: "soulkyn",
    brand: "Soulkyn",
    tagline:
      "Emotionally deep AI companions — goes way beyond surface-level flirting",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.3,
    category: "chat",
  },
  {
    slug: "nomi-ai",
    brand: "Nomi.AI",
    tagline:
      "Your AI girlfriend remembers everything — evolving personality over time",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.6,
    category: "chat",
  },
  // ── High-EPC CrakRevenue direct AI offers (added 2026-05-02) ──
  {
    slug: "joi-ai",
    brand: "Joi AI",
    tagline:
      "Voice-first AI girlfriend — she calls, sexts, and remembers your kinks",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.9,
    badge: "TOP CONVERTER",
    category: "chat",
  },
  {
    slug: "girlfriend-gpt",
    brand: "Girlfriend GPT",
    tagline:
      "Premium AI girlfriend with custom personalities and uncensored mode",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.7,
    badge: "PREMIUM",
    category: "both",
  },
  {
    slug: "secrets-ai",
    brand: "Secrets.ai",
    tagline:
      "Anonymous AI confidante — share your darkest fantasies, no judgement",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.5,
    category: "chat",
  },
  {
    slug: "get-harder",
    brand: "Get Harder",
    tagline: "AI sexting that escalates the way you want — fast and dirty",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "darlink-ai",
    brand: "DarLink AI",
    tagline: "Roleplay-focused AI partner — long-form story-driven sessions",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "lovescape",
    brand: "Lovescape",
    tagline: "Realistic AI dating sim — date her, build chemistry, get nudes",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.5,
    category: "both",
  },
  // ── 7 more direct CR offers (May 2026) ──
  {
    slug: "ehentai-ai",
    brand: "eHentai AI",
    tagline: "AI hentai chat trained on real doujin lore — your perfect waifu",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.6,
    badge: "PURE HENTAI",
    category: "both",
  },
  {
    slug: "ourdream-ai",
    brand: "OurDream AI",
    tagline:
      "Build your dream girl — fully customizable face, body, voice, kinks",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.4,
    category: "both",
  },
  {
    slug: "fantasy-ai",
    brand: "Fantasy AI",
    tagline:
      "Step into any fantasy — fictional, anime, or real — she'll play it",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.3,
    category: "chat",
  },
  {
    slug: "justsext",
    brand: "JustSext",
    tagline: "Pure sexting AI — no foreplay, no chitchat, just dirty messages",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.5,
    badge: "50% LIFETIME",
    category: "chat",
  },
  {
    slug: "mylovely-ai",
    brand: "MyLovely AI",
    tagline:
      "Sweet, romantic AI partner — soft, caring, but turns dirty on demand",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.3,
    category: "chat",
  },
  {
    slug: "xtease-ai",
    brand: "XTease AI",
    tagline:
      "Tease, escalate, climax — multi-stage sexting that builds tension",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "swipey-pps",
    brand: "Swipey",
    tagline: "Tinder-style AI dating — swipe profiles, match, sext, repeat",
    thumbnail: CRAK_MAINSTREAM_300x250,
    rating: 4.3,
    category: "chat",
  },
] as const;

/** Utility — look up a single affiliate by slug. Returns undefined if not found. */
export function getAffiliate(slug: string): Affiliate | undefined {
  return AFFILIATES.find((a) => a.slug === slug);
}
