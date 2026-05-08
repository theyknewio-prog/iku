import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserFavorites } from "@/lib/content";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { FavoritesClient, type InitialFavorite } from "./favorites-client";

export const metadata: Metadata = {
  title: "Favorites — iku.gg",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://iku.gg/favorites" },
};

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const session = await auth();

  let initialItems: InitialFavorite[] | null = null;
  if (session?.user?.id) {
    const videos = await getUserFavorites(session.user.id);
    initialItems = videos.map((v) => ({
      id: v.id,
      slug: v.slug,
      title:
        v.title ||
        v.characters[0]?.replace(/_/g, " ") ||
        v.copyrights[0]?.replace(/_/g, " ") ||
        v.tags.slice(0, 2).join(", ") ||
        "Animated",
      thumbnail: v.thumbnail,
    }));
  }

  return (
    <>
      <FavoritesClient
        initialItems={initialItems}
        isAuthenticated={Boolean(session?.user?.id)}
      />
      {/* AI banners at the bottom of /favorites — noindex page, no SEO
          impact, but logged-in users on this page are highly engaged. */}
      <div style={{ margin: "24px auto 8px" }}>
        <AdRotationBanner slug="candy-ai" surface="page-favorites" />
      </div>
      <div style={{ margin: "8px auto" }}>
        <AdRotationBanner slug="swipey" surface="page-favorites-swipey" />
      </div>
      <div style={{ margin: "16px auto 48px" }}>
        <SoulkynVerticalAd surface="page-favorites-vertical" />
      </div>
    </>
  );
}
