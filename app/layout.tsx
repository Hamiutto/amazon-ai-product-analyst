import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Product Analyst",
  description: "Amazon product analysis assistant for cross-border ecommerce content teams."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
