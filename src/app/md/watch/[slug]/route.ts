// /md/watch/[slug] — markdown mirror of a watch page.
// Used by LLM crawlers. Mounted under /watch/[slug].md too via middleware rewrite.

import { getVideoBySlugAnySource } from "@/lib/video-resolver";
import { containsBannedContent } from "@/lib/content";
import { renderVideoMarkdown } from "@/lib/markdown";

export const revalidate = 86400;
export const dynamicParams = true;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const video = await getVideoBySlugAnySource(slug);

  if (!video) {
    return new Response("# Not found\n\nThis video does not exist.\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  if (containsBannedContent(video)) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const md = renderVideoMarkdown(video);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "index, follow",
    },
  });
}
