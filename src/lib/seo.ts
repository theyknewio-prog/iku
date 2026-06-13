import type { Metadata } from "next";
import type { Video } from "@/types/video";

const SITE = "https://iku.gg";
const NAME = "iku.gg";

/**
 * Single source of truth for the "X+ videos" count shown across the site.
 *
 * Rounded down from the live count of `SELECT COUNT(*) FROM videos
 * WHERE (dead_at IS NULL OR dead_at > NOW())` — was 327,553 on
 * 2026-04-30. Round to 320K to leave headroom and survive purge
 * fluctuations without going stale.
 *
 * Update quarterly (or after large purges/imports) — do NOT inline new
 * numbers in components. Three different counts on the same page
 * (header 353K+, hero 360K+, stats 353K+) shipped 2026-04-30 because
 * each component had its own hardcoded string.
 */
export const VIDEO_COUNT_DISPLAY = "320K+";
export const VIDEO_COUNT_DISPLAY_LONG = "320,000+";

function humanize(tag: string): string {
  return tag.replace(/_/g, " ");
}

// iku.gg targets English SEO. hanime1/rule34video/WP sources ship titles like
// "内射 Hentai" (CJK) or bilingual "【KonoSuba】Yunyun x Kazuma|this is the EN"
// separated by |. We must strip CJK-only portions and keep the Latin half.
const HAS_LATIN_RE = /[a-zA-Z]/;

function pickLatinPortion(raw: string): string {
  const parts = raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return raw.trim();
  let best = parts[0];
  let bestScore = (best.match(/[a-zA-Z]/g) || []).length;
  for (const p of parts.slice(1)) {
    const score = (p.match(/[a-zA-Z]/g) || []).length;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

function videoTitle(v: Video): string {
  // Prefer the real scraped title when it has Latin text. Booru sources
  // (Danbooru/Gelbooru/Rule34) ship empty titles → fall back to synthesis.
  if (v.title && v.title.trim()) {
    const clean = pickLatinPortion(v.title);
    if (HAS_LATIN_RE.test(clean)) return clean;
  }
  const char = v.characters[0] ? humanize(v.characters[0]) : "";
  const copy = v.copyrights[0] ? humanize(v.copyrights[0]) : "";
  const artist = v.artists[0] ? humanize(v.artists[0]) : "";

  // Distinctive tags (skip structural/generic). These + artist make the
  // synthesized title UNIQUE per clip. Without them every clip of the same
  // character collapsed to one title ("Chun-Li — Street Fighter") → ~11.6K
  // duplicate <title> tags that Yandex AND Google penalise. char + 2 tags +
  // artist is unique for >95% of the booru catalogue. (Google-war, 2026-06-13)
  const TITLE_NOISE = new Set([
    "animated",
    "video",
    "sound",
    "hentai",
    "1girl",
    "1boy",
    "2d",
    "3d",
    "solo",
    "duo",
    "hd",
    "uncensored",
    "censored",
    "has_audio",
    "voice_acted",
    "tagme",
    "english",
    "sound_edit",
    "webm",
    "mp4",
  ]);
  const distTags = v.tags
    .filter((t) => HAS_LATIN_RE.test(t) && t.length > 2 && !TITLE_NOISE.has(t))
    .slice(0, 2)
    .map(humanize);

  let base = "";
  if (char && copy) base = `${char} — ${copy}`;
  else if (char) base = char;
  else if (copy) base = copy;

  if (base) {
    const extra = [distTags.join(", "), artist ? `by ${artist}` : ""]
      .filter(Boolean)
      .join(" ");
    return extra ? `${base} — ${extra}` : base;
  }

  // No character/copyright: build from distinctive (or any Latin) tags + artist.
  const latinTags = v.tags.filter((t) => HAS_LATIN_RE.test(t));
  const tagBase = (
    distTags.length
      ? distTags
      : (latinTags.length ? latinTags : v.tags).slice(0, 3).map(humanize)
  ).join(", ");
  if (tagBase) return artist ? `${tagBase} by ${artist}` : tagBase;
  return `Hentai Video #${v.id}`;
}

export function buildVideoMetadata(video: Video): Metadata {
  const title = videoTitle(video);
  const tags = [...video.characters, ...video.tags]
    .slice(0, 5)
    .map(humanize)
    .join(", ");
  const pageTitle = `${title} Hentai | ${NAME}`;
  const description = `Watch free ${title} hentai video. ${tags ? `Tags: ${tags}.` : ""} Stream animated hentai clips on iku.gg.`;
  const canonical = `${SITE}/watch/${video.slug}`;

  return {
    title: pageTitle,
    description,
    keywords: [
      title,
      "hentai",
      "animated hentai",
      "free hentai",
      ...video.characters.slice(0, 3).map(humanize),
    ],
    other: { rating: "adult" },
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      siteName: NAME,
      type: "video.other",
      images: video.thumbnail
        ? [{ url: video.thumbnail, alt: title }]
        : undefined,
      videos: video.url
        ? [
            {
              url: video.url,
              type: "video/mp4",
              width: video.width,
              height: video.height,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "player",
      title: pageTitle,
      description,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export function buildTagMetadata(
  tagName: string,
  videoCount: number,
  page: number,
): Metadata {
  const label = humanize(tagName);
  const pageTitle =
    page > 1
      ? `${label} Hentai Videos — Page ${page} | ${NAME}`
      : `${label} Hentai Videos — Best ${label} Anime Porn | ${NAME}`;
  const description = `Watch ${videoCount > 0 ? `${videoCount.toLocaleString()}+` : "free"} ${label} hentai videos on iku.gg. Stream the best animated ${label} hentai clips.`;
  const canonical =
    page > 1
      ? `${SITE}/tag/${encodeURIComponent(tagName)}?page=${page}`
      : `${SITE}/tag/${encodeURIComponent(tagName)}`;

  return {
    title: pageTitle,
    description,
    keywords: [
      label,
      `${label} hentai`,
      "hentai",
      "animated hentai",
      "free hentai",
    ],
    other: { rating: "adult" },
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      siteName: NAME,
      type: "website",
    },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export function buildVideoJsonLd(video: Video): object {
  const title = videoTitle(video);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${title} hentai`,
    description: `${title} hentai animated video. Stream free on iku.gg.`,
    thumbnailUrl: video.thumbnail || undefined,
    contentUrl: video.url || undefined,
    embedUrl: `${SITE}/watch/${video.slug}`,
    uploadDate: video.createdAt.toISOString(),
    duration: video.duration ? `PT${Math.floor(video.duration)}S` : undefined,
    isFamilyFriendly: false,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: video.score,
    },
    keywords: [title, "hentai", ...video.tags.slice(0, 5).map(humanize)].join(
      ", ",
    ),
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
