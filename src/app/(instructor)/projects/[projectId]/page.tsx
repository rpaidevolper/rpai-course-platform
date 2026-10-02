import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, PROJECTS } from "@/lib/mockup/data";
import { ARTIFACT_LABELS, CLIENT_DOCUMENT_LABELS } from "@/lib/mockup/types";
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
  unassignedRequirements,
} from "@/lib/mockup/logic";
import { Badge, Breadcrumb, CARD, Empty, FieldLabel, MockAction, PageHeader, ProjectStatusBadge, SectionTitle } from "../../../_components/ui";

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
  const unassigned = unassignedRequirements(project, COURSES);
  const unassignedIds = new Set(unassigned.map((r) => r.id));
  const findArtifact = (artifactId: string) => {
    for (const course of courses) {
      const artifact = course.artifacts.find((a) => a.id === artifactId);
      if (artifact) return { course, artifact };
    }
    return undefined;
  };

  return (
    <>
      <Breadcrumb items={[{ label: "專案", href: "/projects" }, { label: project.title }]} />
      <PageHeader title={project.title} description={<ProjectStatusBadge status={project.status} />}>
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
              <FieldLabel>IT 限制</FieldLabel>
              <dd className="mt-0.5 text-sm text-navy">
                {ctx.itConstraints.length === 0 ? (
                  <span className="text-body-muted">沒有記錄</span>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {ctx.itConstraints.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>客戶品牌</FieldLabel>
              <dd className="mt-0.5 text-sm text-navy">
                {ctx.brand ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block size-4 shrink-0 rounded-sm ring-1 ring-navy"
                      style={{ backgroundColor: ctx.brand.primaryColor }}
                    />
                    <span className="font-bold">{ctx.brand.name}</span>
                    <span className="text-body-muted">主題色 {ctx.brand.primaryColor}</span>
                    <span className="basis-full">{ctx.brand.note}</span>
                  </span>
                ) : (
                  <span className="text-body-muted">未填，產物使用 RPAI 品牌</span>
                )}
              </dd>
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

      <section aria-labelledby="docs-heading" className="mb-12">
        <SectionTitle aside={`${project.clientDocuments.length} 份`}>
          <span id="docs-heading">客戶文件</span>
        </SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-body-muted">只傳一次，之後每次藍圖對話都讀得到；學員永遠看不到。</p>
        {project.clientDocuments.length === 0 ? (
          <Empty>還沒有客戶文件。</Empty>
        ) : (
          <ul className="divide-y-2 divide-iced overflow-hidden rounded-lg bg-white shadow-[0_3px_16px_rgba(1,20,85,0.06)]">
            {project.clientDocuments.map((d) => {
              const responds = d.respondsToOutlineId ? findArtifact(d.respondsToOutlineId) : undefined;
              return (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy">{d.title}</p>
                    <p className="mt-0.5 break-all text-xs text-body-muted">
                      {d.fileName}，{formatDate(d.receivedAt)}收到
                    </p>
                    {responds && (
                      <p className="mt-1 text-xs">
                        回應{" "}
                        <Link href={`/courses/${responds.course.id}`} className="font-bold text-navy underline underline-offset-2">
                          {responds.course.title}
                        </Link>{" "}
                        的{ARTIFACT_LABELS[responds.artifact.kind]} v{responds.artifact.version}
                      </p>
                    )}
                  </div>
                  <Badge tone={d.kind === "feedback" ? "outline" : "neutral"}>{CLIENT_DOCUMENT_LABELS[d.kind]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="requirements-heading" className="mb-12">
        <SectionTitle
          aside={unassigned.length > 0 ? `${unassigned.length} 條沒人負責` : `${project.requirements.length} 條`}
        >
          <span id="requirements-heading">需求條目</span>
        </SectionTitle>
        {project.requirements.length === 0 ? (
          <Empty>還沒有需求條目。從客戶文件整理出要求後，指定由哪門課程負責。</Empty>
        ) : (
          <ul className="divide-y-2 divide-iced overflow-hidden rounded-lg bg-white shadow-[0_3px_16px_rgba(1,20,85,0.06)]">
            {project.requirements.map((r) => {
              const owner = unassignedIds.has(r.id) ? undefined : courses.find((c) => c.id === r.courseId);
              const source = project.clientDocuments.find((d) => d.id === r.sourceDocumentId);
              return (
                <li key={r.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-sm text-navy">{r.text}</p>
                    <p className="mt-0.5 text-xs text-body-muted">
                      {source ? `出自〈${source.title}〉` : "講師記錄"}
                      {r.minutes !== null && `，客戶要求 ${r.minutes} 分鐘`}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    {owner ? (
                      <>
                        <span className="text-xs font-bold text-body-muted">負責課程 </span>
                        <Link href={`/courses/${owner.id}`} className="font-bold text-navy underline underline-offset-2">
                          {owner.title}
                        </Link>
                      </>
                    ) : (
                      <Badge tone="warning">沒人負責</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
                        {c.copiedFrom ? (
                          <>
                            ，複製自「{courses.find((x) => x.id === c.copiedFrom!.courseId)?.title ?? c.copiedFrom.courseId}」藍圖 v
                            {c.copiedFrom.blueprintVersion}
                          </>
                        ) : c.source && fw && (
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
