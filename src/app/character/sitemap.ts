import type { MetadataRoute } from "next";
import { CHARACTERS } from "@/data/characters";

const SITE = "https://iku.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const indexPage: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/character`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const characterPages: MetadataRoute.Sitemap = CHARACTERS.map((c) => ({
    url: `${SITE}/character/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...indexPage, ...characterPages];
}
