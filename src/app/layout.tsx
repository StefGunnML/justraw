import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JustRaw - Rude French Simulator",
  description: "Learn French by talking to Pierre, the rude Parisian waiter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
