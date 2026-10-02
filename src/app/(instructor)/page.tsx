import Link from "next/link";
import { MOCK_NOW } from "@/lib/mockup/data";
import {
  dateParts,
  formatDate,
  formatTime,
  getCourse,
  getProject,
  pendingDrafts,
  readiness,
  readinessText,
  upcomingSessions,
} from "@/lib/mockup/logic";
import { Badge, CARD, PageHeader } from "../_components/ui";

/** 講師首頁：接下來的場次，依日期排在一條日程軸上，每場列出準備度缺項。 */
export default function HomePage() {
  const sessions = upcomingSessions(MOCK_NOW);
  const drafts = pendingDrafts();

  return (
    <>
      <PageHeader
        title="接下來的課"
        description={`今天是${formatDate(MOCK_NOW)}。每一場列出還沒準備好的事，處理完就會消失。`}
      />

      <ol className="space-y-5">
        {sessions.map((s, i) => {
          const course = getCourse(s.courseId)!;
          const project = getProject(course.projectId)!;
          const items = readiness(s);
          const { day, month } = dateParts(s.startsAt);
          const next = i === 0;

          return (
            <li key={s.id} className="grid grid-cols-[3.75rem_1fr] gap-4 sm:grid-cols-[5.5rem_1fr] sm:gap-6">
              <div className="pt-3 text-right">
                <div className={`font-bold leading-none text-navy ${next ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl"}`}>
                  {day}
                </div>
                <div className="mt-1.5 text-xs font-bold text-body-muted">{month}</div>
              </div>

              <article className={`${CARD} p-5 ${next ? "border-l-[3px] border-navy" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-navy">
                      <Link href={`/sessions/${s.id}`} className="hover:underline">
                        {course.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-sm">
                      <Link href={`/projects/${project.id}`} className="underline-offset-2 hover:text-navy hover:underline">
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

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-body-muted">時間</dt>
                    <dd className="text-navy">
                      {formatDate(s.startsAt)} {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-body-muted">地點</dt>
                    <dd className={s.venue === "地點未定" ? "font-bold text-warning" : "text-navy"}>{s.venue}</dd>
                  </div>
                </dl>

                {items.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t-2 border-iced pt-4 text-sm">
                    {items.map((item, j) => (
                      <li key={j} className="flex gap-2.5">
                        <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-warning" />
                        <span>{readinessText(item)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      {drafts.length > 0 && (
        <aside className="mt-10 rounded-lg bg-iced px-5 py-4 text-sm sm:ml-[7rem]">
          <span className="font-bold text-navy">知識庫有 {drafts.length} 份草稿等你審核。</span>{" "}
          上完的課會自動拆出框架與情境，確認後才會收進知識庫。{" "}
          <Link href="/knowledge" className="font-bold text-navy underline underline-offset-2">
            去審核
          </Link>
        </aside>
      )}
    </>
  );
}
