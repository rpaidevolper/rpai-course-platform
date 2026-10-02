import Link from "next/link";
import { ResetDemoButton } from "../_components/demo-runtime";

/** 學員端外框：單欄置中，沒有講師導覽。底部一行 demo 說明，讓展示時能切回講師端。 */
export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8 sm:py-12">
      <main className="flex-1">{children}</main>
      <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-iced pt-3 text-xs text-body-muted">
        <span>Demo：資料存在這個瀏覽器</span>
        <ResetDemoButton />
        <Link href="/" className="font-bold underline underline-offset-2 hover:text-navy">
          回講師後台
        </Link>
      </footer>
    </div>
  );
}
