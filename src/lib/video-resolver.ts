// Single dispatch from a slug → Video, mirroring the chain in watch/[slug]/page.tsx.
// Used by /md/watch/[slug] markdown mirror so we don't fork that logic.

import { getGelbooruPost } from "@/lib/gelbooru";
import { getRule34Post } from "@/lib/rule34";
import { getRule34VideoPost } from "@/lib/rule34video";
import { getWPHentaiPost } from "@/lib/wp-hentai";
import { getHentaicityPost } from "@/lib/hentaicity";
import { getSfmCompilePost } from "@/lib/sfmcompile";
import { get3dHentaiTubePost } from "@/lib/3dhentaitube";
import { getEpornerPost } from "@/lib/eporner";
import { getGenericSourcePost } from "@/lib/generic-source";
import {
  extractIdFromSlug,
  isGelbooruSlug,
  isRule34Slug,
  isRule34VideoSlug,
  isWPHentaiSlug,
  isHentaicitySlug,
  isSfmCompileSlug,
  is3dHentaiTubeSlug,
  isEpornerSlug,
  getGenericSource,
} from "@/lib/slugify";
import { getDanbooruVideo } from "@/lib/content";
import type { Video } from "@/types/video";

export async function getVideoBySlugAnySource(
  slug: string,
): Promise<Video | null> {
  try {
    const id = extractIdFromSlug(slug);
    const genericSource = getGenericSource(slug);
    if (genericSource) return await getGenericSourcePost(genericSource, id);
    if (isHentaicitySlug(slug)) return await getHentaicityPost(id);
    if (isSfmCompileSlug(slug)) return await getSfmCompilePost(id);
    if (is3dHentaiTubeSlug(slug)) return await get3dHentaiTubePost(id);
    if (isEpornerSlug(slug)) return await getEpornerPost(id);
    if (isWPHentaiSlug(slug)) return await getWPHentaiPost(id);
    if (isRule34VideoSlug(slug)) return await getRule34VideoPost(id);
    if (isRule34Slug(slug)) return await getRule34Post(id);
    if (isGelbooruSlug(slug)) return await getGelbooruPost(id);
    return await getDanbooruVideo(id, { liveFallback: false });
  } catch {
    return null;
  }
}
