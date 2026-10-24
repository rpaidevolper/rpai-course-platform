"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { makeId } from "@/lib/mockup/actions";
import { CLOSED_FROZEN_REASON, isCourseClosed } from "@/lib/mockup/closing";
import { downloadPlaceholder } from "@/lib/mockup/download";
import {
  artifactVersions,
  formatDate,
  formatDateTime,
  gateBlockText,
  generationGate,
  getCourse,
  getProject,
  getIndustryPack,
  moduleLabel,
  latestBlueprintVersion,
  latestReadyArtifact,
  isHandsOnDay,
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
import { COURSE_TAG_GROUPS, courseSpec, courseTags } from "@/lib/mockup/tags";
import type { Artifact, Course, Project } from "@/lib/mockup/types";
import { BlueprintPanel } from "../../../_components/blueprint-panel";
import { toast } from "../../../_components/demo-runtime";
import { Dialog } from "../../../_components/dialog";
import { RequirementMappingPanel } from "../../../_components/requirement-mapping-panel";
import { SessionDays } from "../../../_components/session-days";
import { TagList, TagPicker } from "../../../_components/tags";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CARD,
  DemoMissing,
  EMPHASIS,
  Empty,
  GatedAction,
  PageHeader,
  SectionNav,
  SectionTitle,
  TextButton,
} from "@/app/_components/ui";
import { ClosingSection } from "./closing-section";
import { ReopenCourseButton } from "./reopen-course";
import { NewSessionButton } from "./new-session-dialog";

const STATUS_TEXT = { pending: "排隊中", generating: "產出中", ready: "可用", failed: "產出失敗" } as const;
const STATUS_TONE = { pending: "neutral", generating: "neutral", ready: "success", failed: "danger" } as const;

/** 課程頁的區塊，依頁面順序；id 是各區塊標題的 id */
const COURSE_SECTIONS: [id: string, text: string][] = [
  ["artifacts", "產物鏈"],
  ["requirement-mapping", "需求對照"],
  ["blueprint", "藍圖"],
  ["materials", "素材"],
  ["sessions", "場次"],
  ["closing", "結案"],
];

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

/**
 * 課程標籤：對象、產業、應用場景存在課程上、可以在這裡改；工具由藍圖的 tools 推得、規格由總時數推得，
 * 這兩組不能在這裡改（改藍圖）。結案後不能改。
 */
function CourseTags({ course }: { course: Course }) {
  const [editing, setEditing] = useState(false);
  const closed = isCourseClosed(course);
  return (
    <div>
      <TagList tags={courseTags(course)} spec={courseSpec(course)} />
      <p className="mt-1 text-xs text-body-muted">
        工具由藍圖的工具清單推得、規格由藍圖的總時數推得，藍圖改了會跟著變。
        {!closed && (
          <>
            {" "}
            <TextButton onClick={() => setEditing((e) => !e)}>{editing ? "完成" : "編輯對象、產業、應用場景"}</TextButton>
          </>
        )}
      </p>
      {editing && !closed && (
        <div className="mt-3 max-w-2xl rounded-lg bg-card p-4 shadow-[0_3px_16px_rgba(1,20,85,0.06)]">
          <TagPicker
            groups={COURSE_TAG_GROUPS}
            value={course}
            onChange={(tags) => dispatch({ type: "course/updateTags", courseId: course.id, tags })}
          />
        </div>
      )}
    </div>
  );
}

export function CourseView({ courseId }: { courseId: string }) {
  const st = useDemoState();
  const hydrated = useHydrated();
  const materialInput = useRef<HTMLInputElement>(null);
  const course = getCourse(st, courseId);
  const project = course && getProject(st, course.projectId);
  if (!course || !project) return <DemoMissing what="課程" loading={!hydrated} />;

  const industryPack = course.source ? getIndustryPack(st, course.source.industryPackId) : undefined;
  const latestBp = latestBlueprintVersion(course);
  const history = [...course.blueprintHistory].sort((a, b) => b.version - a.version);
  const latestBpFinalized = history[0].finalizedAt !== null;
  const sessions = sessionsOfCourse(st, course.id);
  const closed = isCourseClosed(course);
  const copiedFrom = course.copiedFrom ? getCourse(st, course.copiedFrom.courseId) : undefined;

  const finalizeBlueprint = () => {
    dispatch({ type: "blueprint/finalize", courseId: course.id });
    toast(`藍圖 v${latestBp} 已定稿，可以產簡報`);
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
      <Breadcrumb items={[{ label: "專案", href: "/demo/projects" }, { label: project.title, href: `/demo/projects/${project.id}` }, { label: course.title }]} />
      <PageHeader
        title={course.title}
        description={
          course.copiedFrom && copiedFrom ? (
            <>
              <p>
                以課程「
                <Link href={`/demo/courses/${copiedFrom.id}`} className="font-bold text-accent underline underline-offset-2">
                  {copiedFrom.title}
                </Link>
                」藍圖 v{course.copiedFrom.blueprintVersion} 為底複製。
              </p>
              <p className="mt-1 text-body-muted">內容是複製來的，之後兩邊各改各的；每個單元的來源與沿用程度見下方藍圖。</p>
            </>
          ) : course.source && industryPack ? (
            <>
              <p>
                從模組卡「
                {course.source.modules.map((m, i) => (
                  <span key={m.moduleId}>
                    {i > 0 && "、"}
                    <Link href={`/demo/knowledge#module-${m.moduleId}`} className="font-bold text-accent underline underline-offset-2">
                      {moduleLabel(m.moduleId)}
                    </Link>{" "}
                    v{m.version}
                  </span>
                ))}
                」與產業素材包「
                <Link href={`/demo/knowledge#${industryPack.id}`} className="font-bold text-accent underline underline-offset-2">
                  {industryPack.title}
                </Link>
                」談出。
              </p>
              <p className="mt-1 text-body-muted">之後模組卡改版不會影響這份藍圖。</p>
            </>
          ) : (
            <p>這份藍圖是從零談出的，沒有套用知識庫的模組卡。</p>
          )
        }
      >
        {closed && <Badge tone="success">已結案</Badge>}
        {closed ? (
          <Button disabled title={CLOSED_FROZEN_REASON}>
            繼續跟 AI 談藍圖
          </Button>
        ) : (
          <ButtonLink href={`/demo/courses/${course.id}/chat`}>繼續跟 AI 談藍圖</ButtonLink>
        )}
      </PageHeader>

      {closed && (
        <div role="note" className={`${CARD} ${EMPHASIS} -mt-4 mb-8 flex flex-wrap items-center justify-between gap-3 p-4 text-sm`}>
          <p>
            <span className="font-bold text-ink">{CLOSED_FROZEN_REASON}。</span>
            場次、產物、藍圖和素材都已凍結，查看、下載與管理學員入口仍可以。
          </p>
          <ReopenCourseButton st={st} course={course} />
        </div>
      )}

      <div className="-mt-4 mb-6">
        <CourseTags course={course} />
      </div>

      <SectionNav label="課程頁區塊" items={COURSE_SECTIONS} />

      <section aria-labelledby="artifacts" className="mb-10">
        <SectionTitle aside="產檔在你自己的 Claude Code 裡跑，用 RPAI 課程 skill">
          <span id="artifacts">產物鏈</span>
        </SectionTitle>
        <p className="-mt-1 mb-4 max-w-2xl text-xs text-body-muted">
          藍圖 → 課程大綱、講師準備單；藍圖 → 每天的簡報（講稿在簡報備忘稿裡）→ 那天的學員手冊。上游換了新版本，下游就標成過期。藍圖定稿後才能產簡報；某天的簡報定稿後才能產那天的學員手冊。學員手冊只給有動手環節的天，純講述的天不產。
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-bold text-ink">課綱討論</h3>
            <ul className="grid gap-3 md:grid-cols-2">
              <ArtifactCard course={course} project={project} series={{ kind: "outline", day: null }} />
              <ArtifactCard course={course} project={project} series={{ kind: "prep_sheet", day: null }} />
            </ul>
          </div>

          {course.blueprint.days.map((d, i) => (
            <div key={i}>
              <h3 className="mb-2 text-sm font-bold text-ink">
                第 {i + 1} 天<span className="font-normal">・{d.theme}</span>
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                <ArtifactCard course={course} project={project} series={{ kind: "slides", day: i + 1 }} />
                {isHandsOnDay(course, i + 1) ? (
                  <ArtifactCard course={course} project={project} series={{ kind: "handbook", day: i + 1 }} />
                ) : (
                  <li className={`${CARD} min-w-0 p-5`}>
                    <h4 className="text-base font-bold text-ink">第 {i + 1} 天學員手冊</h4>
                    <p className="mt-1.5 text-sm text-body-muted">這一天的單元都是純講述，沒有動手環節，不產學員手冊。</p>
                  </li>
                )}
              </ul>
            </div>
          ))}
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
          <div className="rounded-lg bg-layer p-5">
            <h3 className="text-sm font-bold text-ink">版本紀錄</h3>
            <ol className="mt-3 space-y-4">
              {history.map((v) => (
                <li key={v.version} className={`pl-3 ${v.version === latestBp ? EMPHASIS : ""}`}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
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
              <div className="mt-4 border-t-2 border-card pt-3">
                <p className="mb-2 text-xs">
                  {closed ? `v${latestBp} 沒有定稿。${CLOSED_FROZEN_REASON}。` : `v${latestBp} 還沒定稿；定稿後才能產簡報。課程大綱與講師準備單隨時可以產。`}
                </p>
                <Button variant="secondary" onClick={finalizeBlueprint} disabled={closed} title={closed ? CLOSED_FROZEN_REASON : undefined}>
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
            <ul className={`${CARD} divide-y-2 divide-layer px-5`}>
              {course.materials.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0 break-words text-ink">{m.name}</span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-xs text-body-muted">{formatSize(m.sizeKb)}</span>
                    {!closed && (
                      <TextButton
                        tone="danger"
                        onClick={() => {
                          dispatch({ type: "material/remove", courseId: course.id, materialId: m.id });
                          toast(`已移除素材「${m.name}」；已發布的場次不受影響，直到再次發布`);
                        }}
                      >
                        移除
                      </TextButton>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <input ref={materialInput} type="file" multiple hidden onChange={addMaterials} />
            <Button variant="secondary" onClick={() => materialInput.current?.click()} disabled={closed} title={closed ? CLOSED_FROZEN_REASON : undefined}>
              上傳素材
            </Button>
            {closed && <p className="mt-1 text-xs text-body-muted">{CLOSED_FROZEN_REASON}，素材不能新增或移除。</p>}
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
                    <Link href={`/demo/sessions/${s.id}`} className="font-bold text-accent underline-offset-2 hover:underline">
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
            {closed ? (
              <p className="text-sm text-body-muted">{CLOSED_FROZEN_REASON}：不能新增場次，也不能改場次的日期與連結。要再開同樣的課，請複製這門課程。</p>
            ) : (
              <NewSessionButton course={course} now={st.now} />
            )}
          </div>
        </section>
      </div>

      <ClosingSection st={st} course={course} />
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
  const isSlides = series.kind === "slides";
  const canFinalize = isSlides && latest?.status === "ready" && latest.finalizedAt === null && !stale;
  const busy = latest?.status === "pending" || latest?.status === "generating";
  const frozen = isCourseClosed(course);
  const canMarkSent = isOutline && latest?.status === "ready" && !latest.sentToClientAt && !frozen;

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
    <li className={`${CARD} min-w-0 p-5 ${stale ? EMPHASIS : ""}`}>
      <h4 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-ink">
        {label}
        {latest && <span className="text-2xl leading-none">v{latest.version}</span>}
        {latest && <Badge tone={STATUS_TONE[latest.status]}>{STATUS_TEXT[latest.status]}</Badge>}
        {latest?.editedFromId && <Badge tone="outline">講師修改</Badge>}
        {isSlides && latest?.finalizedAt && <Badge tone="success">已定稿</Badge>}
        {isSlides && latest?.status === "ready" && !latest.finalizedAt && <Badge tone="warning">還沒定稿</Badge>}
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
                  <span className="font-bold text-ink">v{a.version}</span>（藍圖 v{a.blueprintVersion}
                  {a.editedFromId ? "，講師修改" : ""}
                  {a.finalizedAt ? "，已定稿" : ""}
                  {a.status !== "ready" ? `，${STATUS_TEXT[a.status]}` : ""}）
                  {a.sentToClientAt && <span className="font-bold text-ink">・{formatDate(a.sentToClientAt)}已寄給客戶</span>}
                  {feedback.map((d) => (
                    <span key={d.id}>
                      ・客戶回饋：
                      <Link href={`/demo/projects/${project.id}#docs-heading`} className="font-bold text-accent underline underline-offset-2">
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
        {frozen ? (
          <Button variant="secondary" disabled title={CLOSED_FROZEN_REASON}>
            產出新版本
          </Button>
        ) : (
          <GatedAction
            id={`gate-${series.kind}-${series.day ?? "all"}`}
            blocks={blocks}
            variant={!latest || stale ? "primary" : "secondary"}
            onClick={request}
            busy={busy}
          >
            {!latest ? `產出${label}` : stale ? "依最新藍圖與上游重新產出" : "產出新版本"}
          </GatedAction>
        )}
        {latest?.status === "ready" && (
          <Button variant="secondary" onClick={() => download(course, latest)}>
            下載
          </Button>
        )}
        {canFinalize && !frozen && (
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "artifact/finalize", courseId: course.id, artifactId: latest.id });
              toast(`${label} v${latest.version} 已定稿${isHandsOnDay(course, series.day!) ? `，可以產第 ${series.day} 天的學員手冊` : ""}`);
            }}
          >
            把 v{latest.version} 標成定稿
          </Button>
        )}
      </div>
      {/* 不常用的動作降成文字按鈕，按鈕列只留產出、下載、定稿，看得出主要動作 */}
      {(latestReady || canMarkSent) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {latestReady && (
            <>
              <input ref={uploadInput} type="file" hidden onChange={uploadEdit} />
              <TextButton disabled={busy || frozen} title={frozen ? CLOSED_FROZEN_REASON : undefined} onClick={() => uploadInput.current?.click()}>
                上傳講師修改版
              </TextButton>
            </>
          )}
          {canMarkSent && <TextButton onClick={() => setConfirmSent(true)}>標記已寄給客戶</TextButton>}
        </div>
      )}
      {frozen && <p className="mt-2 text-xs text-body-muted">{CLOSED_FROZEN_REASON}；可以查看與下載。</p>}

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
