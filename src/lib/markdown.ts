// Markdown rendering helpers for /md/* mirrors and /llms*.txt indexes.
// These produce LLM-friendly text/markdown — clean, dense, no JS/CSS noise.
// Used to be cited 3-5× more than HTML/JS-rendered pages by ChatGPT, Claude,
// Perplexity and Google AI Overviews.

import type { Video } from "@/types/video";
import type { BlogArticle } from "@/data/blog-types";
import type { GlossaryTerm } from "@/data/glossary";

const SITE = "https://iku.gg";

function fmt(s: string): string {
  return s.replace(/_/g, " ");
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// HTML → markdown for blog content (the BLOG_ARTICLES contain raw HTML).
// We don't pull a full library — the corpus only uses a known subset of tags.
export function htmlToMarkdown(html: string): string {
  let out = html;

  // Block-level
  out = out.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl, c) => {
    const hashes = "#".repeat(Math.min(6, Math.max(1, parseInt(lvl, 10))));
    return `\n\n${hashes} ${stripTags(c).trim()}\n\n`;
  });
  out = out.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_m, c) => `\n\n${c.trim()}\n\n`,
  );
  out = out.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_m, c) => `\n\n> ${stripTags(c).trim().replace(/\n/g, "\n> ")}\n\n`,
  );
  out = out.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_m, c) =>
      `\n\n${c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x: string, t: string) => `- ${inlineToMd(t).trim()}\n`)}\n`,
  );
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, c) => {
    let i = 0;
    return `\n\n${c.replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_x: string, t: string) => {
        i += 1;
        return `${i}. ${inlineToMd(t).trim()}\n`;
      },
    )}\n`;
  });
  out = out.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");
  out = out.replace(/<br\s*\/?>/gi, "\n");

  // Inline
  out = inlineToMd(out);

  // Cleanup: collapse 3+ newlines, trim
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function inlineToMd(s: string): string {
  let o = s;
  o = o.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, txt) => {
      const t = stripTags(txt).trim();
      return `[${t}](${href})`;
    },
  );
  o = o.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  o = o.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");
  o = o.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  o = stripTags(o);
  // Decode common HTML entities
  o = o
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
  return o;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// ───────── Renderers ─────────

export function renderVideoMarkdown(v: Video): string {
  const title =
    v.characters.slice(0, 2).map(fmt).join(" & ") ||
    v.tags.slice(0, 3).map(fmt).join(", ") ||
    `Video #${v.id}`;
  const copyright = v.copyrights[0] ? fmt(v.copyrights[0]) : "";
  const dur = formatDuration(v.duration);

  const lines: string[] = [];
  lines.push(`# ${title}${copyright ? ` — ${copyright}` : ""}`);
  lines.push("");
  lines.push(`> Free animated hentai video on iku.gg.`);
  lines.push("");

  // Facts table
  lines.push("## Details");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  if (copyright) lines.push(`| Series | ${copyright} |`);
  if (v.characters.length)
    lines.push(
      `| Characters | ${v.characters.map(fmt).slice(0, 8).join(", ")} |`,
    );
  if (v.artists?.length)
    lines.push(`| Artists | ${v.artists.map(fmt).slice(0, 4).join(", ")} |`);
  if (dur) lines.push(`| Duration | ${dur} |`);
  if (v.width && v.height)
    lines.push(`| Resolution | ${v.width}×${v.height} |`);
  if (v.score) lines.push(`| Score | ${v.score} |`);
  if (v.favorites) lines.push(`| Favorites | ${v.favorites} |`);
  if (v.createdAt)
    lines.push(
      `| Created | ${new Date(v.createdAt).toISOString().slice(0, 10)} |`,
    );
  lines.push("");

  // Tags
  if (v.tags.length) {
    lines.push("## Tags");
    lines.push("");
    lines.push(
      v.tags
        .slice(0, 30)
        .map((t) => `[${fmt(t)}](${SITE}/tag/${encodeURIComponent(t)})`)
        .join(" · "),
    );
    lines.push("");
  }

  // Characters / series links
  if (v.characters.length) {
    lines.push("## Characters");
    lines.push("");
    lines.push(
      v.characters
        .slice(0, 20)
        .map((c) => `[${fmt(c)}](${SITE}/character/${encodeURIComponent(c)})`)
        .join(" · "),
    );
    lines.push("");
  }
  if (v.copyrights.length) {
    lines.push("## Series");
    lines.push("");
    lines.push(
      v.copyrights
        .slice(0, 10)
        .map((c) => `[${fmt(c)}](${SITE}/series/${encodeURIComponent(c)})`)
        .join(" · "),
    );
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`Watch the full video: ${SITE}/watch/${v.slug}`);
  lines.push("");
  return lines.join("\n");
}

export function renderBlogMarkdown(a: BlogArticle): string {
  const lines: string[] = [];
  lines.push(`# ${a.title}`);
  lines.push("");
  lines.push(
    `*Published ${new Date(a.publishedAt).toISOString().slice(0, 10)} · ${a.readingTime} min read*`,
  );
  lines.push("");
  if (a.excerpt) {
    lines.push(`> ${a.excerpt}`);
    lines.push("");
  }
  lines.push(htmlToMarkdown(a.content));
  if (a.tags?.length) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`**Tags:** ${a.tags.join(", ")}`);
  }
  lines.push("");
  lines.push(`Canonical: ${SITE}/blog/${a.slug}`);
  return lines.join("\n");
}

export function renderGlossaryMarkdown(t: GlossaryTerm): string {
  const lines: string[] = [];
  lines.push(`# ${t.title}`);
  lines.push("");
  lines.push(`*${t.category}*`);
  lines.push("");
  lines.push(t.definition);
  lines.push("");
  if (t.relatedTags?.length) {
    lines.push("## Related tags");
    lines.push("");
    lines.push(
      t.relatedTags
        .map((tag) => `[${fmt(tag)}](${SITE}/tag/${encodeURIComponent(tag)})`)
        .join(" · "),
    );
    lines.push("");
  }
  if (t.relatedTerms?.length) {
    lines.push("## Related terms");
    lines.push("");
    lines.push(
      t.relatedTerms.map((s) => `[${s}](${SITE}/glossary/${s})`).join(" · "),
    );
    lines.push("");
  }
  if (t.relatedArticles?.length) {
    lines.push("## Related articles");
    lines.push("");
    lines.push(
      t.relatedArticles.map((s) => `[${s}](${SITE}/blog/${s})`).join(" · "),
    );
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`Canonical: ${SITE}/glossary/${t.slug}`);
  return lines.join("\n");
}

export function renderListingMarkdown(opts: {
  title: string;
  description: string;
  canonical: string;
  videos: Video[];
}): string {
  const { title, description, canonical, videos } = opts;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> ${description}`);
  lines.push("");
  lines.push(`Showing ${videos.length} videos.`);
  lines.push("");
  lines.push("| # | Title | Duration | Tags |");
  lines.push("|---|---|---|---|");
  videos.forEach((v, i) => {
    const t =
      v.characters.slice(0, 2).map(fmt).join(" & ") ||
      v.tags.slice(0, 3).map(fmt).join(", ") ||
      `Video #${v.id}`;
    const dur = formatDuration(v.duration) || "—";
    const tags = v.tags.slice(0, 4).map(fmt).join(", ");
    lines.push(
      `| ${i + 1} | [${t}](${SITE}/watch/${v.slug}) | ${dur} | ${tags} |`,
    );
  });
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`Canonical: ${canonical}`);
  return lines.join("\n");
}
