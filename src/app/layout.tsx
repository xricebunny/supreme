import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supreme",
  description: "A visual price prediction trading game built on Flow",
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
