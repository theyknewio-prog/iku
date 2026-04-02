import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 65,000+ free hentai videos on iku.gg. The best animated hentai clips featuring your favorite anime characters. Browse by tag, character, or trending.",
  keywords: ["hentai", "hentai videos", "animated hentai", "anime porn", "free hentai", "hentai streaming", "hentai clips"],
  other: { rating: "adult" },
  metadataBase: new URL("https://iku.gg"),
  robots: { index: true, follow: true },
  openGraph: {
    title: "iku.gg — Free Hentai Videos",
    description: "Stream 65,000+ free hentai videos. Browse animated hentai by tag, character, and score.",
    siteName: "iku",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} data-theme="dark">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
// force rebuild 1775129902
