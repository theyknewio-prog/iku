/**
 * Shared banned tags list for all scrapers.
 * Content with these tags is NEVER imported into iku.gg.
 * This is a legal and ethical requirement — zero tolerance.
 */

export const BANNED_TAGS = new Set([
  "loli", "lolicon", "lolidom", "loli_focus",
  "shota", "shotacon", "shotadom", "shota_focus",
  "child", "children", "minor", "underage",
  "toddler", "toddlercon", "infant",
  "young_girl", "young_boy", "child_on_child",
  "cub", "baby",
  "oppai_loli", "legal_loli",
  "elementary_school", "kindergarten", "randoseru",
]);

export const BANNED_TITLE_WORDS = [
  "loli", "lolicon", "shota", "shotacon",
  "child", "children", "underage", "minor",
  "toddler", "infant", "kids",
  "young girl", "young boy", "little girl", "little boy",
  "elementary", "kindergarten",
];

/** Check if a tag array contains banned content */
export function hasBannedTags(tags: string[]): boolean {
  return tags.some((t) => BANNED_TAGS.has(t.toLowerCase()));
}

/** Check if a tag string (space-separated) contains banned content */
export function hasBannedTagString(tagString: string): boolean {
  return tagString.split(/\s+/).some((t) => BANNED_TAGS.has(t.toLowerCase()));
}

/** Check if a title contains banned keywords */
export function hasBannedTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return BANNED_TITLE_WORDS.some((w) => lower.includes(w));
}
