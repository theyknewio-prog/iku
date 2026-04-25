// /md/tag/[tag] — markdown listing of videos tagged with [tag].

import { getVideos, isBannedTag } from "@/lib/content";
import { renderListingMarkdown } from "@/lib/markdown";

export const revalidate = 3600;
export const dynamicParams = true;

const SITE = "https://iku.gg";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  if (isBannedTag(decoded)) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const { data: videos } = await getVideos({
    tags: decoded,
    order: "score",
    limit: 60,
    requireThumbnail: true,
  });

  const pretty = decoded.replace(/_/g, " ");
  const md = renderListingMarkdown({
    title: `${pretty} hentai`,
    description: `Top videos tagged ${pretty} on iku.gg.`,
    canonical: `${SITE}/tag/${encodeURIComponent(decoded)}`,
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
