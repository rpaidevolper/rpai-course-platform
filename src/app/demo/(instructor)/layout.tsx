import Link from "next/link";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { ResetDemoButton } from "../_components/demo-runtime";
import { InstructorNav } from "../_components/instructor-nav";

/**
 * 設計稿的講師端外框：最上面一條 demo 說明（會捲走），下面是頂部列（品牌、導覽、深淺色）＋置中單欄內容。
 * 頂部列在平板以上單行、黏住（高度要跟 globals.css 的 --header-h 一致）；手機兩行、不黏住，不佔畫面。
 * 學員入口在 (student) 群組，不會看到這組導覽。
 */
export default function InstructorLayout({ children }: LayoutProps<"/demo">) {
  return (
    <div className="min-h-screen">
      <div className="bg-layer">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-xs text-body-muted sm:px-8">
          <p>設計稿 demo：假資料存在這個瀏覽器，未接資料庫與 AI。</p>
          <ResetDemoButton />
          <Link href="/" className="font-bold underline underline-offset-2 hover:text-accent">
            回真實後台
          </Link>
        </div>
      </div>
      <header className="z-20 border-b-[3px] border-accent bg-card sm:sticky sm:top-0">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 px-4 sm:h-16 sm:flex-nowrap sm:px-8">
          <Link href="/demo" className="block py-2.5 sm:py-0">
            <span className="block text-xs font-bold text-body-muted">RPAI 數位優化器</span>
            <span className="block text-base font-bold text-ink">講師後台</span>
          </Link>
          <ThemeToggle className="ml-auto sm:order-last" />
          <InstructorNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
