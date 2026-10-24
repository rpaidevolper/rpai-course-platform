import { DemoRuntime } from "./_components/demo-runtime";

/** 設計稿（#22、#48、#53）：資料存在瀏覽器，不接資料庫與 AI。保留在 /demo 當設計參考（待決-1）。 */
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      {children}
      <DemoRuntime />
    </>
  );
}
