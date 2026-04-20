import type { Metadata } from "next";
import type { Video } from "@/types/video";

const SITE = "https://iku.gg";
const NAME = "iku.gg";

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
  if (char && copy) return `${char} — ${copy}`;
  if (char) return char;
  if (copy) return copy;
  // Prefer Latin-script tags for the synthesis fallback (EN SEO). If none,
  // accept anything so the title is never empty.
  const latinTags = v.tags.filter((t) => HAS_LATIN_RE.test(t));
  const tagList = latinTags.length > 0 ? latinTags : v.tags;
  return tagList.slice(0, 3).map(humanize).join(", ") || `Video #${v.id}`;
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
