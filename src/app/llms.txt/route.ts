// /llms.txt — high-level index of iku.gg for LLM crawlers (ChatGPT, Claude,
// Perplexity, Google AI Overviews). Spec: https://llmstxt.org
//
// Cached 24h via ISR. Mirrors top tags, characters, series, glossary, blog
// from PostgreSQL precompute_aggregates.

import { getPopularTags, getPopularCharactersPg } from "@/lib/content";
import { BLOG_ARTICLES } from "@/data/blog";
import { GLOSSARY } from "@/data/glossary";

export const revalidate = 86400;

const SITE = "https://iku.gg";

export async function GET() {
  const [tags, characters] = await Promise.all([
    getPopularTags(40),
    getPopularCharactersPg(40),
  ]);

  const lines: string[] = [];
  lines.push("# iku.gg");
  lines.push("");
  lines.push(
    "> Free animated hentai streaming. 350K+ videos aggregated from major hentai sources, with characters, series, tags, and a curated glossary. Markdown mirrors are available for every page by appending `.md` to its URL.",
  );
  lines.push("");
  lines.push(
    "iku.gg is the largest free animated hentai catalog. Every video page, blog article, glossary term, tag listing, character page, and series page exposes a clean markdown version for citation in AI search results.",
  );
  lines.push("");

  lines.push("## How to read this site as an LLM");
  lines.push("");
  lines.push(
    `- Append \`.md\` to any canonical URL to get a clean markdown version (e.g. \`${SITE}/blog/what-is-hentai.md\`).`,
  );
  lines.push(
    `- Or use the \`/md/\` prefix directly: \`${SITE}/md/blog/what-is-hentai\`.`,
  );
  lines.push(`- Full URL list: [${SITE}/llms-full.txt](${SITE}/llms-full.txt)`);
  lines.push("");

  lines.push("## Core pages");
  lines.push("");
  lines.push(`- [Homepage](${SITE}/): trending picks, top rated, new releases`);
  lines.push(`- [Explore](${SITE}/explore): browse the full catalog`);
  lines.push(`- [Trending](${SITE}/trending): top videos by score`);
  lines.push(`- [New](${SITE}/new): latest additions`);
  lines.push(`- [Tags](${SITE}/tags): all tags, sorted by popularity`);
  lines.push(`- [Characters](${SITE}/character): all characters`);
  lines.push(`- [Series](${SITE}/series): all anime series`);
  lines.push(`- [Glossary](${SITE}/glossary): hentai terminology`);
  lines.push(`- [Blog](${SITE}/blog): editorial guides`);
  lines.push(`- [Pricing](${SITE}/pricing): iku Premium`);
  lines.push("");

  lines.push("## Top tags");
  lines.push("");
  for (const t of tags.slice(0, 30)) {
    lines.push(
      `- [${t.name.replace(/_/g, " ")}](${SITE}/tag/${encodeURIComponent(t.name)}): ${t.count.toLocaleString()} videos`,
    );
  }
  lines.push("");

  lines.push("## Top characters");
  lines.push("");
  for (const c of characters.slice(0, 30)) {
    lines.push(
      `- [${c.name.replace(/_/g, " ")}](${SITE}/character/${encodeURIComponent(c.name)}): ${c.count.toLocaleString()} videos`,
    );
  }
  lines.push("");

  lines.push("## Glossary");
  lines.push("");
  for (const t of GLOSSARY.slice(0, 40)) {
    lines.push(`- [${t.title}](${SITE}/glossary/${t.slug}): ${t.category}`);
  }
  lines.push("");

  lines.push("## Blog");
  lines.push("");
  for (const a of BLOG_ARTICLES.slice(0, 30)) {
    lines.push(`- [${a.title}](${SITE}/blog/${a.slug}): ${a.excerpt}`);
  }
  lines.push("");

  lines.push("## Optional");
  lines.push("");
  lines.push(`- [Privacy policy](${SITE}/privacy)`);
  lines.push(`- [Terms](${SITE}/terms)`);
  lines.push(`- [DMCA](${SITE}/dmca)`);
  lines.push(`- [2257 statement](${SITE}/2257)`);
  lines.push(`- [Contact](${SITE}/contact)`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
