import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES } from "@/lib/mockup/data";
import {
  formatDate,
  formatDateTime,
  formatTime,
  getFramework,
  getProject,
  getScenario,
  isStale,
  latestArtifact,
  latestBlueprintVersion,
  sessionsOfCourse,
  VENUE_UNSET,
} from "@/lib/mockup/logic";
import { ARTIFACT_KINDS, ARTIFACT_LABELS } from "@/lib/mockup/types";
import { BlueprintPanel } from "../../../_components/blueprint-panel";
import { Badge, Breadcrumb, Card, CARD, Empty, MockAction, PageHeader, SectionTitle } from "../../../_components/ui";

export function generateStaticParams() {
  return COURSES.map((c) => ({ courseId: c.id }));
}
export const dynamicParams = false;

const STATUS_TEXT = { pending: "排隊中", generating: "產出中", ready: "可用", failed: "產出失敗" } as const;
const STATUS_TONE = { pending: "neutral", generating: "neutral", ready: "success", failed: "danger" } as const;

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

export default async function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  const { courseId } = await params;
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) notFound();

  const project = getProject(course.projectId)!;
  const framework = course.source ? getFramework(course.source.frameworkId) : undefined;
  const scenario = course.source ? getScenario(course.source.scenarioId) : undefined;
  const latestBp = latestBlueprintVersion(course);
  const history = [...course.blueprintHistory].sort((a, b) => b.version - a.version);
  const sessions = sessionsOfCourse(course.id);

  return (
    <>
      <Breadcrumb items={[{ label: project.title, href: `/projects/${project.id}` }, { label: course.title }]} />
      <PageHeader
        title={course.title}
        description={
          course.source && framework && scenario ? (
            <>
              <p>
                從框架「
                <Link href={`/knowledge#${framework.id}`} className="font-bold text-navy underline underline-offset-2">
                  {framework.title}
                </Link>
                」v{course.source.frameworkVersion} 與情境「
                <Link href={`/knowledge#${scenario.id}`} className="font-bold text-navy underline underline-offset-2">
                  {scenario.title}
                </Link>
                」談出。
              </p>
              <p className="mt-1 text-body-muted">之後框架改版不會影響這份藍圖。</p>
            </>
          ) : (
            <p>這份藍圖是從零談出的，沒有套用知識庫的框架。</p>
          )
        }
      >
        <MockAction>繼續跟 AI 談藍圖</MockAction>
      </PageHeader>

      <section aria-labelledby="artifacts" className="mb-10">
        <SectionTitle aside="產檔在你自己的 Claude Code 裡跑，用 RPAI 課程 skill">
          <span id="artifacts">產物</span>
        </SectionTitle>
        <ul className="space-y-3">
          {ARTIFACT_KINDS.map((kind) => {
            const label = ARTIFACT_LABELS[kind];
            const latest = latestArtifact(course, kind);
            const older = course.artifacts.filter((a) => a.kind === kind && a !== latest).sort((a, b) => b.version - a.version);
            const stale = latest ? isStale(course, latest) : false;

            return (
              <li key={kind} className={`${CARD} p-5 ${stale ? "border-l-[3px] border-navy" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-navy">
                      {label}
                      {latest && <span className="text-2xl leading-none">v{latest.version}</span>}
                      {latest && <Badge tone={STATUS_TONE[latest.status]}>{STATUS_TEXT[latest.status]}</Badge>}
                      {stale && <Badge tone="warning">已過期：藍圖已到 v{latestBp}</Badge>}
                    </h3>
                    {latest ? (
                      <p className="mt-1.5 text-sm">
                        出自藍圖 v{latest.blueprintVersion}，{formatDateTime(latest.createdAt)} 產出
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-body-muted">還沒產出</p>
                    )}
                  </div>
                  {!latest ? (
                    <MockAction>產出{label}</MockAction>
                  ) : stale ? (
                    <MockAction>從最新藍圖重新產出</MockAction>
                  ) : null}
                </div>
                {older.length > 0 && (
                  <p className="mt-3 text-xs text-body-muted">
                    舊版本：{older.map((a) => `v${a.version}（藍圖 v${a.blueprintVersion}）`).join("、")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="blueprint" className="mb-10">
        <SectionTitle aside={`目前是 v${latestBp}`}>
          <span id="blueprint">藍圖</span>
        </SectionTitle>
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
          <Card>
            <BlueprintPanel blueprint={course.blueprint} />
          </Card>
          <div className="rounded-lg bg-iced p-5">
            <h3 className="text-sm font-bold text-navy">版本紀錄</h3>
            <ol className="mt-3 space-y-4">
              {history.map((v) => (
                <li key={v.version} className={v.version === latestBp ? "border-l-[3px] border-navy pl-3" : "pl-[15px]"}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
                    v{v.version}
                    {v.version === latestBp && <Badge tone="outline">目前</Badge>}
                  </p>
                  <p className="text-xs text-body-muted">{formatDateTime(v.createdAt)}</p>
                  <p className="mt-1 text-sm">{v.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="materials">
          <SectionTitle aside="素材屬於課程，每一場都一樣">
            <span id="materials">素材</span>
          </SectionTitle>
          {course.materials.length === 0 ? (
            <Empty>還沒有素材。把講義範例、練習檔放進來，發布時就能一起給學員。</Empty>
          ) : (
            <ul className={`${CARD} divide-y-2 divide-iced px-5`}>
              {course.materials.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0 break-words text-navy">{m.name}</span>
                  <span className="shrink-0 text-xs text-body-muted">{formatSize(m.sizeKb)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <MockAction variant="secondary">上傳素材</MockAction>
          </div>
        </section>

        <section aria-labelledby="sessions">
          <SectionTitle aside="這門課開過與要開的場次">
            <span id="sessions">場次</span>
          </SectionTitle>
          {sessions.length === 0 ? (
            <Empty>這門課還沒有場次。</Empty>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id} className={`${CARD} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/sessions/${s.id}`} className="font-bold text-navy underline-offset-2 hover:underline">
                      {formatDate(s.startsAt)} {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                    </Link>
                    {s.publication ? <Badge tone="success">已發布</Badge> : <Badge tone="warning">還沒發布</Badge>}
                  </div>
                  <p className={`mt-1 text-sm ${s.venue === null ? "font-bold text-warning" : ""}`}>{s.venue ?? VENUE_UNSET}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
