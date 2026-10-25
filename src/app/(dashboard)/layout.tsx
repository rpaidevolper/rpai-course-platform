import Link from "next/link";
import { ThemeToggle } from "../_components/theme-toggle";
import { signOut } from "./session";

/**
 * 登入後的外框：頁首有品牌、設計稿連結與登出。
 * 登入檢查在各頁自己做（layout 不會每次導覽都重跑）。
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="border-b-[3px] border-accent bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="font-bold text-ink">
            RPAI 課程平台
          </Link>
          <Link href="/demo" className="text-sm font-bold text-body hover:text-ink">
            看設計稿
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className="rounded-md px-2.5 py-1.5 text-xs font-bold text-accent underline underline-offset-2 hover:bg-layer">
                登出
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
