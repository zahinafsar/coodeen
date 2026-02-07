import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zahin Afsar — Frontend Engineer",
  description:
    "Frontend Engineer crafting elegant, performant web experiences with TypeScript, React, and Next.js. Open source contributor and tooling enthusiast.",
  keywords: [
    "Zahin Afsar",
    "Frontend Engineer",
    "React",
    "Next.js",
    "TypeScript",
    "Portfolio",
  ],
  authors: [{ name: "Zahin Afsar", url: "https://github.com/zahinafsar" }],
  openGraph: {
    title: "Zahin Afsar — Frontend Engineer",
    description:
      "Frontend Engineer crafting elegant, performant web experiences with TypeScript, React, and Next.js.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
