import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iku.gg — swipe anime",
  description: "The best anime & hentai video feed. Swipe, discover, enjoy.",
  metadataBase: new URL("https://iku.gg"),
  robots: { index: false, follow: false },
  openGraph: {
    title: "iku.gg",
    description: "Swipe. Discover. Enjoy.",
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
      <body>{children}</body>
    </html>
  );
}
