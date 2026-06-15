import type { Metadata } from "next";
import { EB_Garamond, Hanken_Grotesk, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Dungeon Crawler type system (see design/DESIGN.md):
//   EB Garamond   — weathered serif for display/headlines (stone inscriptions)
//   Hanken Grotesk — clean sans for body copy (long rules text)
//   Geist          — technical face for stat labels / numeric readouts
const display = EB_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const stat = Geist({
  variable: "--font-stat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Table Monsters",
  description: "A codex of tabletop adventures — rate, rank, and discover board games with your party.",
  icons: {
    icon: "/icon.png",
    apple: "/sanic.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dungeon theme is dark-first: force the `dark` class so all dark: variants
    // resolve regardless of the OS color-scheme preference.
    <html lang="en" className="dark">
      <head>
        {/* Material Symbols icon font. Loaded via <link> rather than a CSS
            @import — Turbopack/Lightning CSS strips remote @import url() rules
            from globals.css, so the font never reached the browser and every
            icon fell back to its raw ligature text. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${stat.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
