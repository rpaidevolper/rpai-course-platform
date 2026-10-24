import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import { CARD } from "./ui";

/** 登入頁與「尚未加入工作區」頁的外框：置中的一張卡片，沒有講師導覽。 */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-body-muted">RPAI 數位優化器・講師後台</p>
        <ThemeToggle />
      </div>
      <section className={`${CARD} mt-3 p-6`}>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <div className="mt-4 space-y-4 text-sm">{children}</div>
      </section>
    </main>
  );
}
