import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserFavorites } from "@/lib/content";
import { FavoritesClient, type InitialFavorite } from "./favorites-client";

export const metadata: Metadata = {
  title: "Favorites — iku.gg",
  robots: { index: false, follow: false },
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
    <FavoritesClient
      initialItems={initialItems}
      isAuthenticated={Boolean(session?.user?.id)}
    />
  );
}
