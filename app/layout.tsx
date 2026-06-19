import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RigShift — On-Chain Shift Tracking for Field Workers",
  description:
    "Clock in. Clock out. Get paid. RigShift puts oilfield shift records on-chain and rewards workers with USDC for every verified shift.",
  keywords: ["oilfield", "shift tracking", "blockchain", "USDC", "Arc Network"],
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
