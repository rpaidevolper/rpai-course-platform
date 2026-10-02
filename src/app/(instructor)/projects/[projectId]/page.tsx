import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/mockup/data";
import {
  coursesOfProject,
  formatDate,
  formatTime,
  formatTwd,
  getFramework,
  getProject,
  getScenario,
  latestBlueprintVersion,
  readiness,
  sessionsOfCourse,
} from "@/lib/mockup/logic";
import { Badge, Breadcrumb, CARD, Empty, FieldLabel, MockAction, PageHeader, SectionTitle } from "../../../_components/ui";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ projectId: p.id }));
}
export const dynamicParams = false;

/** 專案頁：上方是客戶背景（會帶進每門新課程的藍圖），下方是課程列表。 */
export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const ctx = project.clientContext;
  const scenario = getScenario(ctx.scenarioId);
  const courses = coursesOfProject(project.id);

  return (
    <>
      <Breadcrumb items={[{ label: "專案", href: "/projects" }, { label: project.title }]} />
      <PageHeader title={project.title}>
        <MockAction>在這個專案開新課程</MockAction>
      </PageHeader>

      <section aria-labelledby="client-heading" className="mb-12">
        <div className={`${CARD} border-l-[3px] border-navy p-6`}>
          <h2 id="client-heading" className="text-lg font-bold text-navy">
            客戶背景
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-bold text-navy">
            在這個專案底下開新課程時，AI 會先把客戶背景帶進藍圖，不用再問一次。
          </p>

          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <FieldLabel>公司</FieldLabel>
              <dd className="mt-0.5 text-sm text-navy">{ctx.company}</dd>
            </div>
            <div>
              <FieldLabel>產業</FieldLabel>
              <dd className="mt-0.5 text-sm text-navy">{ctx.industry}</dd>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>培訓目標</FieldLabel>
              <dd className="mt-0.5 text-sm text-navy">{ctx.goal}</dd>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>選定的情境</FieldLabel>
              <dd className="mt-0.5 text-sm">
                {scenario ? (
                  <Link href={`/knowledge#${scenario.id}`} className="font-bold text-navy underline underline-offset-2">
                    {scenario.title}
                  </Link>
                ) : (
                  <span className="text-body-muted">還沒選情境</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-iced pt-4">
            <span className="text-xs font-bold text-body-muted">專案價格</span>
            <span className="text-xl font-bold text-navy">{formatTwd(project.priceTwd)}</span>
            <span className="text-xs text-body-muted">只有講師看得到</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="courses-heading">
        <SectionTitle aside={`${courses.length} 門課程`}>
          <span id="courses-heading">課程</span>
        </SectionTitle>

        {courses.length === 0 ? (
          <Empty>這個專案還沒有課程。開新課程時，AI 會先帶入上面的客戶背景。</Empty>
        ) : (
          <ul className="divide-y-2 divide-iced overflow-hidden rounded-lg bg-white shadow-[0_3px_16px_rgba(1,20,85,0.06)]">
            {courses.map((c) => {
              const sessions = sessionsOfCourse(c.id);
              const missing = sessions.reduce((n, s) => n + readiness(s).length, 0);
              const fw = c.source ? getFramework(c.source.frameworkId) : undefined;
              return (
                <li key={c.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-navy">
                        <Link href={`/courses/${c.id}`} className="hover:underline">
                          {c.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-sm">
                        藍圖 v{latestBlueprintVersion(c)}
                        {c.source && fw && (
                          <>
                            ，來自{" "}
                            <Link href={`/knowledge#${fw.id}`} className="text-navy underline underline-offset-2">
                              {fw.title} v{c.source.frameworkVersion}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    {sessions.length === 0 ? (
                      <Badge>還沒排場次</Badge>
                    ) : missing === 0 ? (
                      <Badge tone="success">場次都準備好了</Badge>
                    ) : (
                      <Badge tone="warning">場次共差 {missing} 件事</Badge>
                    )}
                  </div>

                  {sessions.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {sessions.map((s) => (
                        <li key={s.id}>
                          <Link href={`/sessions/${s.id}`} className="text-navy underline-offset-2 hover:underline">
                            {formatDate(s.startsAt)} {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
