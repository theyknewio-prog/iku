import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Righteous } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const righteous = Righteous({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-righteous",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 353,000+ free hentai videos on iku.gg. The best animated hentai clips featuring your favorite anime characters. Browse by tag, character, or trending.",
  keywords: ["hentai", "hentai videos", "animated hentai", "anime porn", "free hentai", "hentai streaming", "hentai clips"],
  other: { rating: "adult" },
  metadataBase: new URL("https://iku.gg"),
  robots: { index: true, follow: true },
  openGraph: {
    title: "iku.gg — Free Hentai Videos",
    description: "Stream 353,000+ free hentai videos. Browse animated hentai by tag, character, and score.",
    siteName: "iku",
    type: "website",
    images: [{ url: "/og-default.svg", width: 1200, height: 630, alt: "iku.gg — Free Animated Hentai" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "iku.gg — Free Hentai Videos",
    description: "Stream 353,000+ free hentai videos. Browse animated hentai by tag, character, and score.",
    images: ["/og-default.svg"],
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
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${righteous.variable}`} data-theme="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "iku.gg",
              url: "https://iku.gg",
              description: "Stream 353,000+ free hentai videos. The best animated hentai clips featuring your favorite anime characters.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://iku.gg/tag/{search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
// force rebuild 1775129902
