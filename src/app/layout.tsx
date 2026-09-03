import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPAI Course Platform",
  description: "跟 AI 討論出教學藍圖，再從同一份藍圖生成大綱、簡報與學員手冊",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
