import type { MetadataRoute } from "next";
import { SERIES } from "@/data/series";

const SITE = "https://iku.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const indexPage: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/series`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const seriesPages: MetadataRoute.Sitemap = SERIES.map((s) => ({
    url: `${SITE}/series/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...indexPage, ...seriesPages];
}
