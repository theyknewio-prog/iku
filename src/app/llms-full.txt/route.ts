// /llms-full.txt — extended URL index. Lists every canonical URL on iku.gg
// that has a markdown mirror, capped at safe sizes for LLM context windows.

import {
  getPopularTags,
  getPopularCharactersPg,
  getVideos,
} from "@/lib/content";
import { BLOG_ARTICLES } from "@/data/blog";
import { GLOSSARY } from "@/data/glossary";

export const revalidate = 86400;

const SITE = "https://iku.gg";

export async function GET() {
  const [tags, characters, top, recent] = await Promise.all([
    getPopularTags(200),
    getPopularCharactersPg(200),
    getVideos({ order: "score", limit: 500, requireThumbnail: true }),
    getVideos({ order: "date", limit: 200, requireThumbnail: true }),
  ]);
  const topVideos = top.data;
  const newVideos = recent.data;

  const lines: string[] = [];
  lines.push("# iku.gg — full URL index");
  lines.push("");
  lines.push(
    "> Append `.md` to any URL below to get a clean markdown version. Used by LLM crawlers to surface iku.gg in AI search results.",
  );
  lines.push("");

  lines.push("## Static pages");
  lines.push("");
  for (const p of [
    "/",
    "/explore",
    "/trending",
    "/new",
    "/browse",
    "/tags",
    "/character",
    "/series",
    "/glossary",
    "/blog",
    "/leaderboard",
    "/pricing",
    "/privacy",
    "/terms",
    "/dmca",
    "/2257",
    "/contact",
  ]) {
    lines.push(`- ${SITE}${p}`);
  }
  lines.push("");

  lines.push("## Blog articles");
  lines.push("");
  for (const a of BLOG_ARTICLES) {
    lines.push(`- ${SITE}/blog/${a.slug}.md — ${a.title}`);
  }
  lines.push("");

  lines.push("## Glossary terms");
  lines.push("");
  for (const t of GLOSSARY) {
    lines.push(`- ${SITE}/glossary/${t.slug}.md — ${t.title}`);
  }
  lines.push("");

  lines.push("## Tags (top 200 by usage)");
  lines.push("");
  for (const t of tags) {
    lines.push(
      `- ${SITE}/tag/${encodeURIComponent(t.name)}.md — ${t.name.replace(/_/g, " ")} (${t.count.toLocaleString()})`,
    );
  }
  lines.push("");

  lines.push("## Characters (top 200 by appearances)");
  lines.push("");
  for (const c of characters) {
    lines.push(
      `- ${SITE}/character/${encodeURIComponent(c.name)}.md — ${c.name.replace(/_/g, " ")} (${c.count.toLocaleString()})`,
    );
  }
  lines.push("");

  lines.push("## Top videos by score (500)");
  lines.push("");
  for (const v of topVideos) {
    const t =
      v.characters
        .slice(0, 2)
        .map((s) => s.replace(/_/g, " "))
        .join(" & ") ||
      v.tags
        .slice(0, 3)
        .map((s) => s.replace(/_/g, " "))
        .join(", ") ||
      `Video #${v.id}`;
    lines.push(`- ${SITE}/watch/${v.slug}.md — ${t}`);
  }
  lines.push("");

  lines.push("## New videos (200)");
  lines.push("");
  for (const v of newVideos) {
    const t =
      v.characters
        .slice(0, 2)
        .map((s) => s.replace(/_/g, " "))
        .join(" & ") ||
      v.tags
        .slice(0, 3)
        .map((s) => s.replace(/_/g, " "))
        .join(", ") ||
      `Video #${v.id}`;
    lines.push(`- ${SITE}/watch/${v.slug}.md — ${t}`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
