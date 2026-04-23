import type { Video } from "@/types/video";
import { pickGenreTag } from "./video-display";

function fmt(raw: string): string {
  return raw.replace(/_/g, " ");
}

function cap(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function res(w: number, h: number): string {
  if (h >= 2160 || w >= 3840) return "4K";
  if (h >= 1080 || w >= 1920) return "1080p full-HD";
  if (h >= 720 || w >= 1280) return "720p HD";
  return "high-quality";
}

function durWords(s: number | null): string {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m === 0) return `${sec}-second`;
  return sec === 0 ? `${m}-minute` : `${m}-minute ${sec}-second`;
}

function pick(id: number, opts: string[]): string {
  return opts[id % opts.length];
}

export function generateVideoDescription(video: Video): string {
  const char = video.characters[0] ? fmt(video.characters[0]) : "";
  const copy = video.copyrights[0] ? fmt(video.copyrights[0]) : "";
  const artist = video.artists[0] ? fmt(video.artists[0]) : "";
  const quality = res(video.width, video.height);
  const dur = durWords(video.duration);
  const tags = video.tags
    .filter((t) => !["animated", "video", "sound", "3d"].includes(t))
    .slice(0, 5)
    .map(fmt);
  const score = video.score.toLocaleString();

  const parts: string[] = [];

  const intro = pick(video.id, ["Watch", "Stream", "Enjoy"]);
  if (char && copy)
    parts.push(
      `${intro} this ${quality} ${char} hentai animation from ${copy}.`,
    );
  else if (char)
    parts.push(`${intro} this ${quality} ${char} hentai animation.`);
  else if (copy)
    parts.push(`${intro} this ${quality} ${copy} hentai animation.`);
  else parts.push(`${intro} this ${quality} animated hentai clip.`);

  if (tags.length > 0 && dur)
    parts.push(`This ${dur} hentai video features ${tags.join(", ")}.`);
  else if (tags.length > 0)
    parts.push(`This animated hentai features ${tags.join(", ")}.`);

  if (artist)
    parts.push(
      `Created by ${cap(artist)}, this animation has a community score of ${score} on iku.gg.`,
    );
  else if (video.score > 0)
    parts.push(`This animation has a community score of ${score}.`);

  if (char && copy)
    parts.push(
      `Browse more ${char} hentai or explore other ${copy} hentai on iku.gg.`,
    );
  else if (char) parts.push(`Browse more ${char} hentai on iku.gg.`);
  else if (copy)
    parts.push(`Explore more ${copy} hentai animations on iku.gg.`);
  else parts.push(`Explore more animated hentai on iku.gg.`);

  return parts.join(" ");
}

/** Escape user/source-derived values before injecting into answerHtml. */
function esc(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Internal link helper — href + label are HTML-escaped for safety. */
function aTag(href: string, label: string): string {
  return `<a href="${esc(href)}">${esc(label)}</a>`;
}

export interface FAQItem {
  question: string;
  /** Plain-text answer (used by FAQPage JSON-LD + no-JS fallback). */
  answer: string;
  /** Rich HTML with internal <a> links. When present, the watch page
   *  renders this via dangerouslySetInnerHTML. JSON-LD still uses `answer`. */
  answerHtml?: string;
}

/**
 * Enriched FAQ builder — up to 12 questions per video, each with
 * maillage interne (internal links toward /tag/ /character/ /series/
 * /trending /new /pricing /signup /favorites /episodes).
 *
 * The pool below is deterministic on video.id (same video → same FAQ
 * every render, stable for SEO) but varies across videos in the same
 * tag/character page so Google doesn't see duplicate FAQPages.
 */
export function generateVideoFAQ(video: Video): FAQItem[] {
  const char = video.characters[0] ? fmt(video.characters[0]) : "";
  const charSlug = video.characters[0] ?? "";
  const secondaryChar = video.characters[1] ? fmt(video.characters[1]) : "";
  const secondaryCharSlug = video.characters[1] ?? "";
  const copy = video.copyrights[0] ? fmt(video.copyrights[0]) : "";
  const copySlug = video.copyrights[0] ?? "";
  const artist = video.artists[0] ? fmt(video.artists[0]) : "";
  const artistSlug = video.artists[0] ?? "";
  const quality = res(video.width, video.height);
  const tagsPool = video.tags
    .filter((t) => t.length > 2 && !["animated", "video", "sound"].includes(t))
    .slice(0, 8)
    .map((t) => ({ raw: t, label: fmt(t) }));
  const primaryTag = tagsPool[0];
  const secondaryTag = tagsPool[1];
  const dur = durWords(video.duration);
  const durMinutes = video.duration
    ? Math.max(1, Math.round(video.duration / 60))
    : null;

  const charLink = charSlug
    ? aTag(`/character/${encodeURIComponent(charSlug)}`, `more ${char} hentai`)
    : "";
  const secondaryCharLink = secondaryCharSlug
    ? aTag(
        `/character/${encodeURIComponent(secondaryCharSlug)}`,
        `${secondaryChar} hentai`,
      )
    : "";
  const copyLink = copySlug
    ? aTag(`/series/${encodeURIComponent(copySlug)}`, `${copy} hentai series`)
    : "";
  const tagLink = primaryTag
    ? aTag(
        `/tag/${encodeURIComponent(primaryTag.raw)}`,
        `${primaryTag.label} hentai`,
      )
    : "";
  const secondaryTagLink = secondaryTag
    ? aTag(
        `/tag/${encodeURIComponent(secondaryTag.raw)}`,
        `${secondaryTag.label} hentai`,
      )
    : "";
  const trendingLink = aTag("/trending", "trending hentai");
  const newLink = aTag("/new", "new hentai releases");
  // silence unused-var warning if no secondary character data
  void secondaryCharLink;

  const pool: FAQItem[] = [];

  /* ── Subject ── */
  if (char && copy) {
    pool.push({
      question: `What is this ${char} hentai video about?`,
      answer: `This ${quality} animation features ${char} from ${copy}. It's a free hentai clip streaming on iku.gg, with community scoring and related videos after playback.`,
      answerHtml: `This ${quality} animation features <strong>${esc(char)}</strong> from ${copyLink}. It's a free hentai clip streaming on iku.gg, with community scoring and related videos after playback. Browse ${charLink} to see the rest of the catalogue.`,
    });
  } else if (char) {
    pool.push({
      question: `What is this ${char} hentai video about?`,
      answer: `This ${quality} animated hentai stars ${char}. Watch it free on iku.gg alongside other ${char} clips.`,
      answerHtml: `This ${quality} animated hentai stars <strong>${esc(char)}</strong>. Watch it free on iku.gg alongside ${charLink}.`,
    });
  } else if (copy) {
    pool.push({
      question: `What is this ${copy} hentai video about?`,
      answer: `It's a ${quality} animated hentai clip from the ${copy} universe — one of many episodes indexed on iku.gg.`,
      answerHtml: `It's a ${quality} animated hentai clip from the ${copy} universe — one of many episodes indexed in our ${copyLink} collection.`,
    });
  }

  /* ── Duration ── */
  if (dur && char) {
    pool.push({
      question: `How long is this ${char} hentai clip?`,
      answer: `This clip runs ${dur}${durMinutes ? ` (about ${durMinutes} minute${durMinutes > 1 ? "s" : ""})` : ""}. Full-episode hentai usually runs 20+ minutes — for those, check our Premium long-form section.`,
      answerHtml: `This clip runs <strong>${esc(dur)}</strong>${durMinutes ? ` (about ${durMinutes} minute${durMinutes > 1 ? "s" : ""})` : ""}. For longer content, browse ${aTag("/episodes", "full hentai episodes")} on iku.gg.`,
    });
  } else if (dur) {
    pool.push({
      question: "How long is this hentai clip?",
      answer: `This clip runs ${dur}. Most clips on iku.gg are between 30 seconds and 6 minutes — for full episodes, see our long-form section.`,
      answerHtml: `This clip runs <strong>${esc(dur)}</strong>. For longer content, browse ${aTag("/episodes", "full hentai episodes")} on iku.gg.`,
    });
  }

  /* ── Quality ── */
  pool.push({
    question: copy
      ? `Is this ${copy} hentai available in HD or 4K?`
      : "Is this hentai video in HD?",
    answer: `This video is available in ${quality}. iku.gg streams in the best quality the source provides. Premium members get priority streaming when 4K is available.`,
    answerHtml: `This video is available in <strong>${esc(quality)}</strong>. iku.gg streams in the best quality the source provides. Premium members get priority streaming — see ${aTag("/pricing", "Premium plans")}.`,
  });

  /* ── Censorship ── */
  pool.push({
    question: char
      ? `Is this ${char} hentai censored or uncensored?`
      : "Is this hentai censored or uncensored?",
    answer: `Censorship depends on the original release. Most 3D / SFM animations on iku.gg are uncensored; some 2D episodes from Japanese studios are mosaic-censored at the source. iku.gg does not add any censorship.`,
    answerHtml: `Censorship depends on the original release. Most 3D / SFM animations on iku.gg are uncensored; some 2D episodes from Japanese studios are mosaic-censored at the source. iku.gg does not add any censorship. Browse ${aTag("/tag/uncensored", "uncensored hentai")} for fully uncensored titles.`,
  });

  /* ── Download (honest: no) ── */
  pool.push({
    question: "Can I download this hentai video for free?",
    answer: `iku.gg is a streaming platform — we don't offer direct downloads. You can save videos to your iku.gg favorites and watch them again anytime on any device.`,
    answerHtml: `iku.gg is a streaming platform — we don't offer direct downloads. You can save videos to ${aTag("/favorites", "your favorites")} and watch them again anytime on any device. Create a ${aTag("/signup", "free account")} to sync your library across devices.`,
  });

  /* ── Character discovery ── */
  if (char && charSlug) {
    pool.push({
      question: `Where can I watch more ${char} hentai for free?`,
      answer: `iku.gg indexes the full ${char} hentai catalogue — browse every scene, sorted by score, date or duration, all streaming for free.`,
      answerHtml: `iku.gg indexes the full ${char} hentai catalogue — browse every scene on ${charLink}, sorted by score, date or duration, all streaming for free.`,
    });
  }

  /* ── Best-of tag ── */
  if (primaryTag) {
    pool.push({
      question: `What are the best ${primaryTag.label} hentai videos on iku.gg?`,
      answer: `Our ${primaryTag.label} page ranks clips by community score and save count. Check trending to see what's popular this week.`,
      answerHtml: `Our ${tagLink} page ranks clips by community score and save count. Check ${trendingLink} to see what's popular this week, or ${newLink} for fresh uploads.`,
    });
  }

  /* ── Subtitles ── */
  if (copy) {
    pool.push({
      question: `Is ${copy} hentai available with English subtitles?`,
      answer: `Most animated hentai from Japanese studios doesn't ship with official subtitles. 3D / SFM animations are typically dialogue-light. If a title has subtitles, they're baked into the video track.`,
      answerHtml: `Most animated hentai from Japanese studios doesn't ship with official subtitles. 3D / SFM animations are typically dialogue-light. Browse ${copyLink} to see every available episode.`,
    });
  } else {
    pool.push({
      question: "Does this hentai video have English subtitles?",
      answer: `Most 2D hentai from Japanese studios isn't officially subtitled. 3D / SFM animations are typically dialogue-light. When subtitles exist, they're baked into the video track.`,
      answerHtml: `Most 2D hentai from Japanese studios isn't officially subtitled. 3D / SFM animations are typically dialogue-light. When subtitles exist, they're baked into the video track.`,
    });
  }

  /* ── Similar / related ── */
  if (char && primaryTag) {
    pool.push({
      question: `Are there similar ${char} or ${primaryTag.label} hentai videos?`,
      answer: `Yes — iku.gg auto-links every clip to related videos based on shared characters, series and tags. Scroll past the player for "More hentai like this".`,
      answerHtml: `Yes — iku.gg auto-links every clip to related videos based on shared characters, series and tags. Open ${charLink} or ${tagLink} for the full list.`,
    });
  } else if (primaryTag && secondaryTag) {
    pool.push({
      question: `Are there similar ${primaryTag.label} or ${secondaryTag.label} hentai videos?`,
      answer: `Yes — iku.gg auto-links every clip to related videos based on shared tags. Scroll past the player for "More hentai like this".`,
      answerHtml: `Yes — iku.gg auto-links every clip to related videos based on shared tags. Scroll past the player, or open ${tagLink} and ${secondaryTagLink} for the full list.`,
    });
  }

  /* ── Series intro ── */
  if (copy) {
    pool.push({
      question: `What is ${copy} hentai?`,
      answer: `${copy} hentai refers to adult fan-animations or doujin-style clips based on the ${copy} franchise. iku.gg indexes every ${copy} scene we can find, scored by the community.`,
      answerHtml: `${copy} hentai refers to adult fan-animations or doujin-style clips based on the ${copy} franchise. Browse every indexed scene on ${copyLink}, scored by the community.`,
    });
  }

  /* ── Update frequency ── */
  if (primaryTag) {
    pool.push({
      question: `How often does iku.gg add new ${primaryTag.label} hentai?`,
      answer: `We update daily. New ${primaryTag.label} clips hit the site every 24 hours as our indexer finds them. New Releases always shows the freshest uploads.`,
      answerHtml: `We update daily. New ${primaryTag.label} clips hit the site every 24 hours. See the latest additions on ${newLink} or ${tagLink}.`,
    });
  } else {
    pool.push({
      question: "How often does iku.gg add new hentai videos?",
      answer: `Every day. Our indexer runs around the clock — New Releases always shows the freshest clips.`,
      answerHtml: `Every day. Our indexer runs around the clock — see ${newLink} for the latest uploads.`,
    });
  }

  /* ── Free / account ── */
  pool.push({
    question: "Is iku.gg free to watch?",
    answer: `Yes — iku.gg is 100% free, no account required. Create a free account to save favorites, sync watch history across devices, earn points and unlock badges. Premium removes all ads and unlocks 4K + early access.`,
    answerHtml: `Yes — iku.gg is 100% free, no account required. Create a ${aTag("/signup", "free account")} to save favorites, sync watch history, earn points and unlock badges. ${aTag("/pricing", "Premium")} removes all ads and unlocks 4K + early access.`,
  });

  /* ── Mobile / compatibility ── */
  pool.push({
    question: "Can I watch this hentai video on mobile?",
    answer: `Yes. iku.gg runs on any modern browser — mobile, tablet, desktop. The player supports fullscreen, picture-in-picture, 0.5× to 2× speed, and double-tap seek on touch devices.`,
    answerHtml: `Yes. iku.gg runs on any modern browser — mobile, tablet, desktop. The player supports fullscreen, picture-in-picture, 0.5× to 2× speed, and double-tap seek on touch devices.`,
  });

  /* ── Artist ── */
  if (artist && artistSlug) {
    pool.push({
      question: "Who created this hentai animation?",
      answer: `This clip is credited to ${cap(artist)}. Browse more of their work on iku.gg.`,
      answerHtml: `This clip is credited to <strong>${esc(cap(artist))}</strong>. Browse more of their work on ${aTag(`/tag/${encodeURIComponent(artistSlug)}`, `the ${cap(artist)} archive`)}.`,
    });
  }

  /* Cap at 12 to avoid FAQ bloat. */
  return pool.slice(0, 12);
}

export function generateBreadcrumbs(
  video: Video,
): { name: string; url: string }[] {
  const crumbs = [{ name: "Home", url: "https://iku.gg/" }];
  if (video.copyrights[0])
    crumbs.push({
      name: cap(fmt(video.copyrights[0])),
      url: `https://iku.gg/tag/${video.copyrights[0]}`,
    });
  if (video.characters[0])
    crumbs.push({
      name: cap(fmt(video.characters[0])),
      url: `https://iku.gg/tag/${video.characters[0]}`,
    });
  let label: string;
  if (video.characters[0]) {
    label = `${cap(fmt(video.characters[0]))} hentai`;
  } else if (video.copyrights[0]) {
    label = `${cap(fmt(video.copyrights[0]))} hentai`;
  } else {
    const genre = pickGenreTag(video);
    label = genre === "Hentai" ? "Hentai video" : `${cap(genre)} hentai`;
  }
  crumbs.push({ name: label, url: `https://iku.gg/watch/${video.slug}` });
  return crumbs;
}
