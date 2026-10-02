import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPAI 講師後台",
  description: "跟 AI 談出教學藍圖，從同一份藍圖產出教材，並把每一場課的東西集中給學員",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
