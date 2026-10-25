import type { Metadata } from "next";
import { DemoRuntime } from "../_components/demo-runtime";

export const metadata: Metadata = {
  title: "RPAI 講師後台（設計稿）",
};

/**
 * 設計稿的外框（/demo 底下）。產檔模擬與提示訊息只在這裡掛一次；
 * 登入後的課程清單（/）不掛，那邊沒有假資料。
 */
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      {children}
      <DemoRuntime />
    </>
  );
}
