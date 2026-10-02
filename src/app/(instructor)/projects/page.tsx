import Link from "next/link";
import { MOCK_NOW, PROJECTS } from "@/lib/mockup/data";
import { coursesOfProject, formatDate, formatTwd, projectsByStatus, upcomingSessions } from "@/lib/mockup/logic";
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "@/lib/mockup/types";
import { CARD, Empty, MockAction, PageHeader, ProjectStatusBadge, SectionTitle } from "../../_components/ui";

const STATUS_HINTS: Record<ProjectStatus, string> = {
  negotiating: "客戶還在洽談；課綱討論談出的藍圖，成交後直接沿用。",
  active: "已成交、正在準備或交付的專案。",
  archived: "沒成交或已結案的專案，留著查歷史。",
};

/** 專案列表：依狀態分組（洽談中、進行中、封存），封存的與進行中分開。 */
export default function ProjectsPage() {
  const upcoming = upcomingSessions(MOCK_NOW);
  const groups = projectsByStatus(PROJECTS);

  return (
    <>
      <PageHeader title="專案" description="每個專案是與一個客戶的一次合作，從洽談就開始存在，底下可以有多門課程。">
        <MockAction>新增專案</MockAction>
      </PageHeader>

      <div className="space-y-10">
        {groups.map(({ status, projects }) => (
          <section key={status} aria-labelledby={`status-${status}`}>
            <SectionTitle aside={`${projects.length} 個專案`}>
              <span id={`status-${status}`}>{PROJECT_STATUS_LABELS[status]}</span>
            </SectionTitle>
            <p className="-mt-1 mb-3 text-xs text-body-muted">{STATUS_HINTS[status]}</p>
            {projects.length === 0 ? (
              <Empty>沒有{PROJECT_STATUS_LABELS[status]}的專案。</Empty>
            ) : (
              <ul className="space-y-4">
                {projects.map((p) => (
                  <li key={p.id}>
                    <ProjectRow project={p} upcoming={upcoming} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function ProjectRow({ project: p, upcoming }: { project: Project; upcoming: ReturnType<typeof upcomingSessions> }) {
  const courses = coursesOfProject(p.id);
  const courseIds = new Set(courses.map((c) => c.id));
  const next = upcoming.find((s) => courseIds.has(s.courseId));
  return (
    <article className={`${CARD} grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-navy">
            <Link href={`/projects/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          </h3>
          <ProjectStatusBadge status={p.status} />
        </div>
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
  );
}
