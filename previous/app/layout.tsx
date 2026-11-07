import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResolveIQ | AI Customer Support",
  description: "An intelligent customer support platform powered by persistent AI memory."
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