import type { MetadataRoute } from "next";
import { BLOG_ARTICLES } from "@/data/blog";
import { GLOSSARY } from "@/data/glossary";

const SITE = "https://iku.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    // Vertical hubs — top-priority landing pages targeting head keywords
    { url: `${SITE}/hentai`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
    { url: `${SITE}/3d`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
    { url: `${SITE}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/trending`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/new`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE}/tags`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/glossary`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/character`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/series`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const blogPages: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    lastModified: a.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  const glossaryPages: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${SITE}/glossary/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...glossaryPages];
}
