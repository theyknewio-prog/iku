// /md/blog/[slug] — markdown mirror of a blog article.

import { getArticleBySlug } from "@/data/blog";
import { renderBlogMarkdown } from "@/lib/markdown";

export const revalidate = 86400;
export const dynamicParams = true;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) {
    return new Response("# Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
  return new Response(renderBlogMarkdown(article), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "index, follow",
    },
  });
}
