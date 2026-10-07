import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AllInOne API — một API, đăng mọi mạng xã hội",
  description: "Gom TikTok, YouTube, Instagram, Facebook… vào một API remote. Tạo và quản lý nhiều API remote với các API con.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
