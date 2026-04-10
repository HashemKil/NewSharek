import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sharek",
  description: "PSUT Student Collaboration Platform",
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