import Link from "next/link";
import { ResetDemoButton } from "../_components/demo-runtime";
import { InstructorNav } from "../_components/instructor-nav";

/** 講師端外框：頂部 sticky header（品牌、導覽、demo 控制）＋置中單欄內容。學員入口在 (student) 群組，不會看到這組導覽。 */
export default function InstructorLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b-[3px] border-navy bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="block">
            <span className="block text-xs font-bold text-body-muted">RPAI 數位優化器</span>
            <span className="block text-base font-bold text-navy">講師後台</span>
          </Link>
          <InstructorNav />
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-iced pt-2 text-xs text-body-muted lg:ml-auto lg:w-auto lg:border-0 lg:pt-0">
            <p>Demo：假資料存在這個瀏覽器，未接資料庫與 AI。</p>
            <ResetDemoButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
