import Link from "next/link";
import { requireMember } from "@/lib/auth/session";
import { ThemeToggle } from "../_components/theme-toggle";
import { signOut } from "../auth/actions";
import { AppNav } from "./app-nav";

/**
 * 真實後台的外框：只有工作區成員進得來（沒登入的請求已被 src/proxy.ts 導去登入頁）。
 * 頂部列的版型同設計稿（平板以上單行、黏住，高度要跟 globals.css 的 --header-h 一致；手機兩行、不黏住）。
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { member } = await requireMember();
  return (
    <div className="min-h-screen">
      <header className="z-20 border-b-[3px] border-accent bg-card sm:sticky sm:top-0">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 px-4 sm:h-16 sm:flex-nowrap sm:px-8">
          <Link href="/" className="block py-2.5 sm:py-0">
            <span className="block text-xs font-bold text-body-muted">RPAI 數位優化器</span>
            <span className="block text-base font-bold text-ink">講師後台</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 sm:order-last">
            <span className="text-sm font-bold text-ink">{member.displayName}</span>
            <form action={signOut}>
              <button type="submit" className="text-xs font-bold text-body-muted underline underline-offset-2 hover:text-accent">
                登出
              </button>
            </form>
            <ThemeToggle />
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
