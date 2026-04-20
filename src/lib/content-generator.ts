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

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateVideoFAQ(video: Video): FAQItem[] {
  const char = video.characters.slice(0, 3).map(fmt).join(", ");
  const copy = video.copyrights[0] ? fmt(video.copyrights[0]) : "";
  const artist = video.artists[0] ? fmt(video.artists[0]) : "";
  const quality = res(video.width, video.height);
  const tags = video.tags
    .filter((t) => t.length > 2)
    .slice(0, 6)
    .map(fmt);
  const dur = durWords(video.duration);

  const faq: FAQItem[] = [];

  if (char)
    faq.push({
      question: "What character is in this hentai?",
      answer: copy
        ? `This hentai features ${char} from ${copy}.`
        : `This hentai features ${char}.`,
    });
  else if (copy)
    faq.push({
      question: "What series is this hentai from?",
      answer: `This hentai is from ${copy}.`,
    });

  if (artist)
    faq.push({
      question: "Who created this hentai animation?",
      answer: `Created by artist ${cap(artist)}. Browse more of their work on iku.gg.`,
    });
  if (tags.length > 0)
    faq.push({
      question: "What tags does this hentai have?",
      answer: `Tagged with: ${tags.join(", ")}.`,
    });
  faq.push({
    question: "What quality is this hentai video?",
    answer: dur
      ? `A ${dur} ${quality} hentai animation.`
      : `Available in ${quality} on iku.gg.`,
  });

  return faq;
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
