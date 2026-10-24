import Link from "next/link";
import { requireMember } from "@/lib/auth/session";
import { signOut } from "../auth/actions";
import { AppNav } from "./app-nav";

/** 真實後台的外框：只有工作區成員進得來（沒登入的請求已被 src/proxy.ts 導去登入頁）。 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { member } = await requireMember();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b-[3px] border-navy bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="block">
            <span className="block text-xs font-bold text-body-muted">RPAI 數位優化器</span>
            <span className="block text-base font-bold text-navy">講師後台</span>
          </Link>
          <AppNav />
          <div className="flex items-center gap-3 text-sm lg:ml-auto">
            <span className="font-bold text-navy">{member.displayName}</span>
            <form action={signOut}>
              <button type="submit" className="text-xs font-bold text-body-muted underline underline-offset-2 hover:text-navy">
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
