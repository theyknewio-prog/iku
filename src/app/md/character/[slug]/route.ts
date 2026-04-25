// /md/character/[slug] — markdown listing for a character page.

import { getVideos, isBannedTag } from "@/lib/content";
import { getCharacterBySlug, type Character } from "@/data/characters";
import { renderListingMarkdown } from "@/lib/markdown";

export const revalidate = 3600;
export const dynamicParams = true;

const SITE = "https://iku.gg";

function resolveCharacter(slug: string): Character | null {
  const existing = getCharacterBySlug(slug);
  if (existing) return existing;
  if (!slug || slug.length < 2 || slug.length > 80) return null;
  if (!/^[a-z0-9_\-()]+$/i.test(slug)) return null;
  const tag = slug.replace(/-/g, "_");
  const display = slug
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    slug,
    name: display,
    series: "",
    seriesName: "",
    description: `${display} hentai on iku.gg.`,
    tags: [tag],
    relatedCharacters: [],
    seoTitle: `${display} Hentai | iku.gg`,
    seoDescription: `Watch free ${display} hentai on iku.gg.`,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const character = resolveCharacter(slug);
  if (!character || isBannedTag(character.tags[0] || slug)) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  const { data: videos } = await getVideos({
    tags: character.tags[0],
    order: "score",
    limit: 60,
    requireThumbnail: true,
  });

  const md = renderListingMarkdown({
    title: `${character.name} — Hentai videos`,
    description: character.description,
    canonical: `${SITE}/character/${character.slug}`,
    videos,
  });

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}
