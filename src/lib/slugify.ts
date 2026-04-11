/**
 * Generate a URL-safe slug from a Danbooru post.
 * Format: {id}-{character}-{copyright}
 * e.g. "5083150-marie-rose-dead-or-alive"
 */
export function generateSlug(
  id: number,
  character: string,
  copyright: string
): string {
  const parts = [String(id)];

  const cleanChar = sanitize(character);
  if (cleanChar) parts.push(cleanChar);

  const cleanCopy = sanitize(copyright);
  if (cleanCopy) parts.push(cleanCopy);

  return parts.join("-");
}

/**
 * Extract the post ID from a slug.
 * The ID is always the leading numeric segment.
 */
export function extractIdFromSlug(slug: string): number {
  // Strip known prefixes before extracting the numeric ID
  // gel-8742200-xxx → 8742200, r34-14029915-xxx → 14029915, 5083150-xxx → 5083150
  let cleaned = slug;
  if (cleaned.startsWith("gel-")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("r34v-")) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith("r34-")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("hmm-")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("htv-")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("aid-")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("wh-")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("hw-")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("hg-")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("hc-")) cleaned = cleaned.slice(3);

  const match = cleaned.match(/^(\d+)/);
  if (!match) throw new Error(`Invalid slug: ${slug}`);
  return parseInt(match[1], 10);
}

export function isGelbooruSlug(slug: string): boolean {
  return slug.startsWith("gel-");
}

export function isRule34Slug(slug: string): boolean {
  return slug.startsWith("r34-");
}

export function isRule34VideoSlug(slug: string): boolean {
  return slug.startsWith("r34v-");
}

const WP_PREFIXES = ["hmm-", "htv-", "aid-", "wh-", "hw-", "hg-"];
export function isWPHentaiSlug(slug: string): boolean {
  return WP_PREFIXES.some((p) => slug.startsWith(p));
}

export function isHentaicitySlug(slug: string): boolean {
  return slug.startsWith("hc-");
}

/**
 * Sanitize a Danbooru tag string into a URL-safe segment.
 * - Takes only the first tag if multiple are present (space-separated)
 * - Replaces underscores and non-alphanumeric chars with hyphens
 * - Collapses multiple hyphens, trims, lowercases
 */
function sanitize(raw: string): string {
  if (!raw || !raw.trim()) return "";

  // Take only the first tag (most relevant character/copyright)
  const firstTag = raw.trim().split(/\s+/)[0];

  return firstTag
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
