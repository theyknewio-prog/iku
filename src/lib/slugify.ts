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
  const match = slug.match(/^(\d+)/);
  if (!match) throw new Error(`Invalid slug: ${slug}`);
  return parseInt(match[1], 10);
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
