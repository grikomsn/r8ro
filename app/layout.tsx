import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import "./globals.css";

import {
  Lato,
  Lato as V0_Font_Lato,
  Libre_Baskerville as V0_Font_Libre_Baskerville,
  Space_Mono as V0_Font_Space_Mono,
} from "next/font/google";

// Initialize fonts
const _lato = V0_Font_Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
});
const _spaceMono = V0_Font_Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const _libreBaskerville = V0_Font_Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "r8ro — Realtime retrospectives and planning poker",
    template: "%s | r8ro",
  },
  description:
    "Realtime retrospective boards and planning poker with voting, presence, and timers.",
  applicationName: "r8ro",
  metadataBase: new URL("https://r8ro.app"),
  openGraph: {
    title: "r8ro — Realtime retrospectives and planning poker",
    description:
      "Realtime retrospective boards and planning poker with voting, presence, and timers.",
    type: "website",
    locale: "en_US",
    url: "https://r8ro.app",
    siteName: "r8ro",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "r8ro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "r8ro — Realtime retrospectives and planning poker",
    description:
      "Realtime retrospective boards and planning poker with voting, presence, and timers.",
    images: ["/opengraph.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${lato.className} antialiased`}>
        <a
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:py-2 focus-visible:font-bold"
          href="#main-content"
        >
          Skip to main content
        </a>
        <ErrorBoundary
          fallback={<div className="p-8 text-center">App error</div>}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            <AuthProvider>
              <div id="main-content" tabIndex={-1}>
                {children}
              </div>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
