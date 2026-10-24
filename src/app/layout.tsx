import type { Metadata } from "next";
import "./globals.css";
import { DemoRuntime } from "./_components/demo-runtime";
import { ThemeScript } from "./_components/theme-toggle";

export const metadata: Metadata = {
  title: "RPAI 講師後台",
  description: "跟 AI 談出教學藍圖，從同一份藍圖產出教材，並把每一場課的東西集中給學員",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // inline script 在 hydration 前改了 data-theme，讓 React 以 DOM 為準
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        {children}
        <DemoRuntime />
      </body>
    </html>
  );
}
