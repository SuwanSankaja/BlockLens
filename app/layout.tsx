import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "BlockLens Explorer",
  description:
    "Free Bitcoin transaction and address relationship explorer with graph expansion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
