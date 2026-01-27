import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grid Bet - Flow Blockchain Game",
  description: "A visual options trading game built on Flow blockchain with Magic.link authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
