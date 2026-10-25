import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "./_components/theme-toggle";

export const metadata: Metadata = {
  title: "RPAI 課程平台",
  description: "RPAI 講師備課用的團隊記憶與知識後台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // inline script 在 hydration 前改了 data-theme，讓 React 以 DOM 為準
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
