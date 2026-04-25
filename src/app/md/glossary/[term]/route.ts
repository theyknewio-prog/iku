// /md/glossary/[term] — markdown mirror of a glossary entry.

import { getTermBySlug } from "@/data/glossary";
import { renderGlossaryMarkdown } from "@/lib/markdown";
import { isBannedTag } from "@/lib/content";

export const revalidate = 86400;
export const dynamicParams = true;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ term: string }> },
) {
  const { term } = await params;

  // Defense in depth: even though /glossary doesn't list banned terms, the
  // route should refuse to render markdown for any tag tagged as banned.
  if (isBannedTag(term)) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const t = getTermBySlug(term);
  if (!t) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  return new Response(renderGlossaryMarkdown(t), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "index, follow",
    },
  });
}
