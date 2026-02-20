import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Euphoria — FLOW Price Predictions",
  description: "Price prediction trading game for FLOW token",
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
