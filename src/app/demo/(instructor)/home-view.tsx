"use client";

import Link from "next/link";
import {
  dateParts,
  formatDate,
  getCourse,
  getProject,
  pendingDrafts,
  readiness,
  sessionStartsAt,
  upcomingSessions,
} from "@/lib/mockup/logic";
import { useDemoState } from "@/lib/mockup/store";
import { ReadinessList } from "@/app/_components/readiness-list";
import { SessionDays } from "@/app/_components/session-days";
import { Badge, CARD, EMPHASIS, Empty, PageHeader } from "@/app/_components/ui";

/** 講師首頁：接下來的場次，依日期排在一條日程軸上，每場列出準備度缺項，每組附「去處理」連結。 */
export function HomeView() {
  const st = useDemoState();
  const sessions = upcomingSessions(st, st.now);
  const drafts = pendingDrafts(st);

  return (
    <>
      <PageHeader
        title="接下來的課"
        description={`今天是${formatDate(st.now)}。每一場列出還沒準備好的事，處理完就會消失。`}
      />

      {sessions.length === 0 ? (
        <Empty>
          接下來沒有排定的場次。到{" "}
          <Link href="/demo/projects" className="font-bold text-accent underline underline-offset-2">
            專案
          </Link>{" "}
          裡的課程排一場。
        </Empty>
      ) : (
        <ol className="space-y-5">
          {sessions.map((s, i) => {
            const course = getCourse(st, s.courseId);
            const project = course && getProject(st, course.projectId);
            if (!course || !project) return null;
            const items = readiness(st, s, course);
            const { day, month } = dateParts(sessionStartsAt(s));
            const next = i === 0;

            return (
              // 手機上日期放在卡片上方，卡片才有整個寬度；平板以上日期在左欄
              <li key={s.id} className="grid gap-2 sm:grid-cols-[5.5rem_1fr] sm:gap-6">
                <div className="flex items-baseline gap-1.5 sm:block sm:pt-3 sm:text-right">
                  <div className={`font-bold leading-none text-ink ${next ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"}`}>
                    {day}
                  </div>
                  <div className="text-xs font-bold text-body-muted sm:mt-1.5">{month}</div>
                </div>

                <article className={`${CARD} min-w-0 p-5 ${next ? EMPHASIS : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-ink">
                        <Link href={`/demo/sessions/${s.id}`} className="hover:underline">
                          {course.title}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-sm">
                        <Link href={`/demo/projects/${project.id}`} className="underline-offset-2 hover:text-accent hover:underline">
                          {project.title}
                        </Link>
                      </p>
                    </div>
                    {items.length === 0 ? (
                      <Badge tone="success">準備好了</Badge>
                    ) : (
                      <Badge tone="warning">還差 {items.length} 件事</Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    <SessionDays session={s} />
                  </div>

                  {items.length > 0 && (
                    <div className="mt-4 border-t-2 border-layer pt-4">
                      <ReadinessList session={s} items={items} />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {drafts.length > 0 && (
        <aside className="mt-10 rounded-lg bg-layer px-5 py-4 text-sm sm:ml-[7rem]">
          <span className="font-bold text-ink">知識庫有 {drafts.length} 份草稿等你審核。</span>{" "}
          課程結案後，內容會拆成待審核的草稿；確認後才會收進知識庫。{" "}
          <Link href="/demo/knowledge" className="font-bold text-accent underline underline-offset-2">
            去審核
          </Link>
        </aside>
      )}
    </>
  );
}
