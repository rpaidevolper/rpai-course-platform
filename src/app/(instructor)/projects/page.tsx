import Link from "next/link";
import { MOCK_NOW, PROJECTS } from "@/lib/mockup/data";
import { coursesOfProject, formatDate, formatTwd, upcomingSessions } from "@/lib/mockup/logic";
import { CARD, MockAction, PageHeader } from "../../_components/ui";

/** 專案列表：每個專案一列，客戶、課程數、下一場日期與價格。 */
export default function ProjectsPage() {
  const upcoming = upcomingSessions(MOCK_NOW);

  return (
    <>
      <PageHeader title="專案" description="每個專案是與一個客戶的一次合作，底下可以有多門課程。">
        <MockAction>新增專案</MockAction>
      </PageHeader>

      <ul className="space-y-4">
        {PROJECTS.map((p) => {
          const courses = coursesOfProject(p.id);
          const courseIds = new Set(courses.map((c) => c.id));
          const next = upcoming.find((s) => courseIds.has(s.courseId));
          return (
            <li key={p.id}>
              <article className={`${CARD} grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8`}>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-navy">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm">
                    {p.clientContext.company}，{p.clientContext.industry}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-6 text-sm sm:text-right">
                  <div>
                    <dt className="text-xs font-bold text-body-muted">課程</dt>
                    <dd className="mt-0.5 text-navy">{courses.length} 門</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-body-muted">下一場</dt>
                    <dd className="mt-0.5 text-navy">{next ? formatDate(next.startsAt) : "沒有排定"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-body-muted">價格</dt>
                    <dd className="mt-0.5 text-navy">{formatTwd(p.priceTwd)}</dd>
                  </div>
                </dl>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
