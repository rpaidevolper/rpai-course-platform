"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { makeId } from "@/lib/mockup/actions";
import { downloadPlaceholder } from "@/lib/mockup/download";
import {
  artifactVersions,
  formatDate,
  formatDateTime,
  gateBlockText,
  generationGate,
  getCourse,
  getFramework,
  getProject,
  getScenario,
  latestBlueprintVersion,
  latestReadyArtifact,
  outlineFeedback,
  requirementMappingOfCourse,
  seriesLabel,
  sessionDateRange,
  sessionsOfCourse,
  staleReasonText,
  staleReasons,
  unitSourceText,
  type ArtifactSeries,
} from "@/lib/mockup/logic";
import { dispatch, useDemoState, useHydrated } from "@/lib/mockup/store";
import type { Artifact, Course, Project } from "@/lib/mockup/types";
import { BlueprintPanel } from "../../../_components/blueprint-panel";
import { toast } from "../../../_components/demo-runtime";
import { Dialog } from "../../../_components/dialog";
import { RequirementMappingPanel } from "../../../_components/requirement-mapping-panel";
import { SessionDays } from "../../../_components/session-days";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CARD,
  DemoMissing,
  Empty,
  GatedAction,
  PageHeader,
  SectionTitle,
  TextButton,
} from "../../../_components/ui";
import { NewSessionButton } from "./new-session-dialog";

const STATUS_TEXT = { pending: "排隊中", generating: "產出中", ready: "可用", failed: "產出失敗" } as const;
const STATUS_TONE = { pending: "neutral", generating: "neutral", ready: "success", failed: "danger" } as const;

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

export function CourseView({ courseId }: { courseId: string }) {
  const st = useDemoState();
  const hydrated = useHydrated();
  const materialInput = useRef<HTMLInputElement>(null);
  const course = getCourse(st, courseId);
  const project = course && getProject(st, course.projectId);
  if (!course || !project) return <DemoMissing what="課程" loading={!hydrated} />;

  const framework = course.source ? getFramework(st, course.source.frameworkId) : undefined;
  const scenario = course.source ? getScenario(st, course.source.scenarioId) : undefined;
  const latestBp = latestBlueprintVersion(course);
  const history = [...course.blueprintHistory].sort((a, b) => b.version - a.version);
  const latestBpFinalized = history[0].finalizedAt !== null;
  const sessions = sessionsOfCourse(st, course.id);
  const copiedFrom = course.copiedFrom ? getCourse(st, course.copiedFrom.courseId) : undefined;

  const finalizeBlueprint = () => {
    dispatch({ type: "blueprint/finalize", courseId: course.id });
    toast(`藍圖 v${latestBp} 已定稿，可以產逐頁腳本`);
  };

  const addMaterials = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    for (const f of files) {
      dispatch({ type: "material/add", id: makeId("m"), courseId: course.id, name: f.name, sizeKb: Math.max(1, Math.ceil(f.size / 1024)) });
    }
    toast(files.length === 1 ? `已上傳素材「${files[0].name}」` : `已上傳 ${files.length} 個素材`);
  };

  return (
    <>
      <Breadcrumb items={[{ label: project.title, href: `/projects/${project.id}` }, { label: course.title }]} />
      <PageHeader
        title={course.title}
        description={
          course.copiedFrom && copiedFrom ? (
            <>
              <p>
                以課程「
                <Link href={`/courses/${copiedFrom.id}`} className="font-bold text-navy underline underline-offset-2">
                  {copiedFrom.title}
                </Link>
                」藍圖 v{course.copiedFrom.blueprintVersion} 為底複製。
              </p>
              <p className="mt-1 text-body-muted">內容是複製來的，之後兩邊各改各的；每個單元的來源與沿用程度見下方藍圖。</p>
            </>
          ) : course.source && framework && scenario ? (
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
        <ButtonLink href={`/courses/${course.id}/chat`}>繼續跟 AI 談藍圖</ButtonLink>
      </PageHeader>

      <section aria-labelledby="artifacts" className="mb-10">
        <SectionTitle aside="產檔在你自己的 Claude Code 裡跑，用 RPAI 課程 skill">
          <span id="artifacts">產物鏈</span>
        </SectionTitle>
        <p className="-mt-1 mb-4 max-w-2xl text-xs text-body-muted">
          藍圖 → 課程大綱、講師準備單；藍圖 → 每天的逐頁腳本 → 那天的簡報；各天逐頁腳本 → 學員手冊。上游換了新版本，下游就標成過期。藍圖定稿後才能產逐頁腳本；某天的逐頁腳本定稿後才能產那天的簡報；每一天都定稿後才能產學員手冊。
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-bold text-navy">課綱討論</h3>
            <ul className="grid gap-3 md:grid-cols-2">
              <ArtifactCard course={course} project={project} series={{ kind: "outline", day: null }} />
              <ArtifactCard course={course} project={project} series={{ kind: "prep_sheet", day: null }} />
            </ul>
          </div>

          {course.blueprint.days.map((d, i) => (
            <div key={i}>
              <h3 className="mb-2 text-sm font-bold text-navy">
                第 {i + 1} 天<span className="font-normal">・{d.theme}</span>
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                <ArtifactCard course={course} project={project} series={{ kind: "page_script", day: i + 1 }} />
                <ArtifactCard course={course} project={project} series={{ kind: "slides", day: i + 1 }} />
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-2 text-sm font-bold text-navy">整門課</h3>
            <ul className="grid gap-3 md:grid-cols-2">
              <ArtifactCard course={course} project={project} series={{ kind: "handbook", day: null }} />
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="requirement-mapping" className="mb-10">
        <SectionTitle aside="字面與時數由系統比對；實質涵蓋為設計稿標註">
          <span id="requirement-mapping">需求對照</span>
        </SectionTitle>
        <RequirementMappingPanel rows={requirementMappingOfCourse(st, course)} blueprint={course.blueprint} />
      </section>

      <section aria-labelledby="blueprint" className="mb-10">
        <SectionTitle aside={`目前是 v${latestBp}`}>
          <span id="blueprint">藍圖</span>
        </SectionTitle>
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
          <Card>
            <BlueprintPanel blueprint={course.blueprint} sourceLabel={(source) => unitSourceText(st, source)} />
          </Card>
          <div className="rounded-lg bg-iced p-5">
            <h3 className="text-sm font-bold text-navy">版本紀錄</h3>
            <ol className="mt-3 space-y-4">
              {history.map((v) => (
                <li key={v.version} className={v.version === latestBp ? "border-l-[3px] border-navy pl-3" : "pl-[15px]"}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
                    v{v.version}
                    {v.version === latestBp && <Badge tone="outline">目前</Badge>}
                    {v.finalizedAt && <Badge tone="success">已定稿</Badge>}
                  </p>
                  <p className="text-xs text-body-muted">{formatDateTime(v.createdAt)}</p>
                  <p className="mt-1 text-sm">{v.note}</p>
                </li>
              ))}
            </ol>
            {!latestBpFinalized && (
              <div className="mt-4 border-t-2 border-white pt-3">
                <p className="mb-2 text-xs">v{latestBp} 還沒定稿；定稿後才能產逐頁腳本。課程大綱與講師準備單隨時可以產。</p>
                <Button variant="secondary" onClick={finalizeBlueprint}>
                  把 v{latestBp} 標成定稿
                </Button>
              </div>
            )}
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
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-xs text-body-muted">{formatSize(m.sizeKb)}</span>
                    <TextButton
                      tone="danger"
                      onClick={() => {
                        dispatch({ type: "material/remove", courseId: course.id, materialId: m.id });
                        toast(`已移除素材「${m.name}」；已發布的場次不受影響，直到再次發布`);
                      }}
                    >
                      移除
                    </TextButton>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <input ref={materialInput} type="file" multiple hidden onChange={addMaterials} />
            <Button variant="secondary" onClick={() => materialInput.current?.click()}>
              上傳素材
            </Button>
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
                      {sessionDateRange(s)}
                    </Link>
                    {s.publication ? <Badge tone="success">已發布</Badge> : <Badge tone="warning">還沒發布</Badge>}
                  </div>
                  <div className="mt-2">
                    <SessionDays session={s} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <NewSessionButton course={course} now={st.now} />
          </div>
        </section>
      </div>
    </>
  );
}

/** 一個版本綁定了什麼：藍圖版本與上游產物版本。 */
function bindingText(course: Course, a: Artifact): string {
  const ups = a.upstreamIds
    .map((id) => course.artifacts.find((x) => x.id === id))
    .filter((x): x is Artifact => x !== undefined)
    .map((u) => `${seriesLabel(u)} v${u.version}`);
  return `出自藍圖 v${a.blueprintVersion}${ups.length > 0 ? `・上游：${ups.join("、")}` : ""}`;
}

function download(course: Course, a: Artifact) {
  const label = seriesLabel(a);
  downloadPlaceholder(`${course.title}－${label} v${a.version}`, [
    `課程：${course.title}`,
    `產物：${label}`,
    `版本：v${a.version}${a.editedFromId ? "（講師修改版）" : ""}${a.finalizedAt ? "（已定稿）" : ""}`,
    bindingText(course, a),
  ]);
  toast(`已下載${label} v${a.version}（示意檔）`);
}

function ArtifactCard({ course, project, series }: { course: Course; project: Project; series: ArtifactSeries }) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const label = seriesLabel(series);
  const versions = artifactVersions(course, series);
  const latest = versions[0];
  const latestReady = latestReadyArtifact(course, series.kind, series.day);
  const reasons = latest ? staleReasons(course, latest) : [];
  const stale = reasons.length > 0;
  const isOutline = series.kind === "outline";
  const older = isOutline ? versions : versions.slice(1);
  const blocks = generationGate(course, series).map(gateBlockText);
  const isScript = series.kind === "page_script";
  const canFinalize = isScript && latest?.status === "ready" && latest.finalizedAt === null && !stale;
  const busy = latest?.status === "pending" || latest?.status === "generating";

  const request = () => {
    dispatch({ type: "artifact/request", id: makeId("a"), courseId: course.id, kind: series.kind, day: series.day });
    toast(`已排入${label}的產檔工作，稍候就會變成可用`);
  };

  const uploadEdit = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !latestReady) return;
    dispatch({ type: "artifact/uploadEdit", courseId: course.id, baseId: latestReady.id, id: makeId("a") });
    toast(`已上傳「${file.name}」成為${label} v${(latest?.version ?? 0) + 1}，沿用 v${latestReady.version} 的藍圖與上游綁定`);
  };

  return (
    <li className={`${CARD} min-w-0 p-5 ${stale ? "border-l-[3px] border-navy" : ""}`}>
      <h4 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-navy">
        {label}
        {latest && <span className="text-2xl leading-none">v{latest.version}</span>}
        {latest && <Badge tone={STATUS_TONE[latest.status]}>{STATUS_TEXT[latest.status]}</Badge>}
        {latest?.editedFromId && <Badge tone="outline">講師修改</Badge>}
        {isScript && latest?.finalizedAt && <Badge tone="success">已定稿</Badge>}
        {isScript && latest?.status === "ready" && !latest.finalizedAt && <Badge tone="warning">還沒定稿</Badge>}
        {series.kind === "prep_sheet" && <Badge>內部・永不發布</Badge>}
      </h4>
      {latest ? (
        <>
          <p className="mt-1.5 text-sm">{bindingText(course, latest)}</p>
          <p className="text-xs text-body-muted">
            {formatDateTime(latest.createdAt)} {latest.editedFromId ? "上傳" : busy ? "排入" : "產出"}
          </p>
          {stale && (
            <p className="mt-2">
              <Badge tone="warning">已過期：{reasons.map(staleReasonText).join("；")}</Badge>
            </p>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-body-muted">還沒產出</p>
      )}

      {older.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-bold text-body-muted">{isOutline ? "各版本與客戶往返" : "舊版本"}</h5>
          <ol className="mt-1 space-y-1.5 text-xs">
            {older.map((a) => {
              const feedback = isOutline ? outlineFeedback(project, a.id) : [];
              return (
                <li key={a.id}>
                  <span className="font-bold text-navy">v{a.version}</span>（藍圖 v{a.blueprintVersion}
                  {a.editedFromId ? "，講師修改" : ""}
                  {a.finalizedAt ? "，已定稿" : ""}
                  {a.status !== "ready" ? `，${STATUS_TEXT[a.status]}` : ""}）
                  {a.sentToClientAt && <span className="font-bold text-navy">・{formatDate(a.sentToClientAt)}已寄給客戶</span>}
                  {feedback.map((d) => (
                    <span key={d.id}>
                      ・客戶回饋：
                      <Link href={`/projects/${project.id}#docs-heading`} className="font-bold text-navy underline underline-offset-2">
                        {d.title}
                      </Link>
                    </span>
                  ))}
                  {a.status === "ready" && (
                    <>
                      {" "}
                      <TextButton onClick={() => download(course, a)}>下載</TextButton>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <GatedAction
          id={`gate-${series.kind}-${series.day ?? "all"}`}
          blocks={blocks}
          variant={!latest || stale ? "primary" : "secondary"}
          onClick={request}
          busy={busy}
        >
          {!latest ? `產出${label}` : stale ? "依最新藍圖與上游重新產出" : "產出新版本"}
        </GatedAction>
        {latest?.status === "ready" && (
          <Button variant="secondary" onClick={() => download(course, latest)}>
            下載
          </Button>
        )}
        {canFinalize && (
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "artifact/finalize", courseId: course.id, artifactId: latest.id });
              toast(`${label} v${latest.version} 已定稿，可以產第 ${series.day} 天的簡報`);
            }}
          >
            把 v{latest.version} 標成定稿
          </Button>
        )}
        {latestReady && (
          <>
            <input ref={uploadInput} type="file" hidden onChange={uploadEdit} />
            <Button variant="secondary" disabled={busy} onClick={() => uploadInput.current?.click()}>
              上傳講師修改版
            </Button>
          </>
        )}
        {isOutline && latest?.status === "ready" && !latest.sentToClientAt && (
          <Button variant="secondary" onClick={() => setConfirmSent(true)}>
            標記已寄給客戶
          </Button>
        )}
      </div>

      {isOutline && latest && (
        <Dialog
          open={confirmSent}
          onClose={() => setConfirmSent(false)}
          title={`標記課程大綱 v${latest.version} 已寄給客戶？`}
          description={<p>標記後，這一版會在「各版本與客戶往返」記下寄出日期；客戶的回饋可以存成專案的客戶文件，對應到這一版。</p>}
          submitLabel="標記已寄出"
          onSubmit={() => {
            dispatch({ type: "artifact/markSent", courseId: course.id, artifactId: latest.id });
            setConfirmSent(false);
            toast(`課程大綱 v${latest.version} 已標記寄給客戶`);
          }}
        />
      )}
    </li>
  );
}
