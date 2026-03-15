import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import JsonLd from "@/components/JsonLd";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

const SITE_URL = "https://fuelgood.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Fuel Good — Eat real. Feel amazing.",
  description:
    "Scan meals, explore whole-food recipes, and get AI-powered wellness guidance designed to help you make better everyday food decisions.",
  keywords: [
    "nutrition",
    "whole food",
    "meal scan",
    "healthy eating",
    "recipes",
    "wellness",
    "AI nutrition",
    "meal planning",
  ],
  authors: [{ name: "Fuel Good" }],
  openGraph: {
    title: "Fuel Good — Eat real. Feel amazing.",
    description:
      "AI-powered whole-food nutrition — scan meals, explore recipes, and fuel your best self.",
    url: SITE_URL,
    siteName: "Fuel Good",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fuel Good — Eat real. Feel amazing.",
    description:
      "AI-powered whole-food nutrition — scan meals, explore recipes, and fuel your best self.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased bg-bg text-fg`}
      >
        <JsonLd />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
