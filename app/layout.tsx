import type { Metadata } from "next";
import { Silkscreen, Azeret_Mono } from "next/font/google";
import "./globals.css";

// Blocky pixel display face — huge operator headline
const pixel = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

// Mono readout face — status lines, stats, addresses
const mono = Azeret_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RigShift — On-Chain Shift Tracking for Field Workers",
  description:
    "Clock in. Clock out. Get paid. RigShift puts oilfield shift records on-chain and rewards workers with USDC for every verified shift.",
  keywords: ["oilfield", "shift tracking", "blockchain", "USDC", "Arc Network"],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "RigShift",
    description: "On-chain shift tracking for oilfield workers",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pixel.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
