import Link from "next/link";
import { ResetDemoButton } from "../_components/demo-runtime";
import { InstructorNav } from "../_components/instructor-nav";

/** 講師端外框。學員入口在 (student) 群組，不會看到這組導覽。 */
export default function InstructorLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13.5rem_1fr]">
      <aside className="border-b-[3px] border-navy bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-l-0 lg:border-t-[3px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/" className="block">
            <span className="block text-xs font-bold text-body-muted">RPAI 數位優化器</span>
            <span className="block text-base font-bold text-navy">講師後台</span>
          </Link>
          <div className="lg:mt-8">
            <InstructorNav />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-iced px-4 py-2 text-xs leading-relaxed text-body-muted lg:absolute lg:bottom-6 lg:block lg:border-0 lg:px-5 lg:py-0">
          <p>
            Demo：假資料存在這個瀏覽器，
            <br className="hidden lg:inline" />
            未接資料庫與 AI。
          </p>
          <ResetDemoButton className="lg:mt-2" />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
