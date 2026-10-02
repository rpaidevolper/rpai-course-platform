"use client";

import { useState } from "react";
import { addMs } from "@/lib/mockup/actions";
import { getInstructor } from "@/lib/mockup/instructor";
import {
  PORTAL_VALID_DAYS,
  artifactSeries,
  formatDateTime,
  getCourse,
  getProject,
  getSession,
  isPublishable,
  isStale,
  latestArtifact,
  latestReadyArtifact,
  portalExpiresAt,
  portalState,
  readiness,
  seriesLabel,
  sessionDateRange,
  sessionDayCountMismatch,
  type Course,
  type PortalState,
  type Session,
  VENUE_UNSET,
} from "@/lib/mockup/logic";
import type { DemoState } from "@/lib/mockup/state";
import { dispatch, useDemoState, useHydrated } from "@/lib/mockup/store";
import type { IsoTime, SessionDay } from "@/lib/mockup/types";
import { CopyButton } from "../../../_components/copy-button";
import { toast } from "../../../_components/demo-runtime";
import { Dialog } from "../../../_components/dialog";
import { ReadinessList } from "../../../_components/readiness-list";
import { SessionDays } from "../../../_components/session-days";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  CARD,
  DemoMissing,
  Empty,
  Facts,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  TextButton,
  TextInput,
} from "../../../_components/ui";

const PORTAL_BADGE: Record<PortalState, { tone: "neutral" | "success" | "warning" | "danger"; label: string }> = {
  unpublished: { tone: "neutral", label: "未發布" },
  open: { tone: "success", label: "開放中" },
  expired: { tone: "warning", label: "已過期" },
  closed: { tone: "danger", label: "已關閉" },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_TAB_LINK = "inline-flex items-center rounded-md bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-press";

type DialogKind = "publish" | "close" | "extend" | "link" | "info";

/** 會發布給學員的產物系列（講師準備單除外），依產物鏈順序 */
const publishableSeries = (course: Course) => artifactSeries(course).filter((s) => isPublishable(s));

const sameLinks = (a: Session["links"], b: Session["links"]) =>
  a.length === b.length && a.every((l, i) => l.url === b[i].url && l.label === b[i].label);

export function SessionView({ sessionId }: { sessionId: string }) {
  const st = useDemoState();
  const hydrated = useHydrated();
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const session = getSession(st, sessionId);
  const course = session && getCourse(st, session.courseId);
  const project = course && getProject(st, course.projectId);
  if (!session || !course || !project) return <DemoMissing what="場次" loading={!hydrated} />;

  const items = readiness(st, session);
  const dayMismatch = sessionDayCountMismatch(session, course.blueprint);
  const pub = session.publication;
  const state = portalState(session, st.now);
  const badge = PORTAL_BADGE[state];
  const portalPath = `/s/${session.portal.code}`;
  const lockedMaterials = pub ? course.materials.filter((m) => pub.materialIds.includes(m.id)) : [];
  const linksChanged = pub !== null && !sameLinks(pub.links, session.links);
  const closeDialog = () => setDialog(null);

  return (
    <>
      <Breadcrumb
        items={[
          { label: project.title, href: `/projects/${project.id}` },
          { label: course.title, href: `/courses/${course.id}` },
          { label: sessionDateRange(session) },
        ]}
      />
      <PageHeader
        title={`${course.title}　${sessionDateRange(session)}`}
        description="這一場的時間、地點、連結和要給學員的東西，都在這裡。"
      />

      <div className="space-y-8">
        {/* 發布：本頁重點 */}
        <section id="publish" aria-labelledby="publish-title" className={`${CARD} scroll-mt-6 border-l-[3px] border-navy p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="publish-title" className="text-xl font-bold text-navy">
              發布
            </h2>
            {pub ? <Badge tone="success">已發布</Badge> : <Badge tone="warning">還沒發布</Badge>}
          </div>

          {!pub ? (
            <>
              <p className="mt-3 max-w-xl text-sm">
                發布後，學員入口才會打開；之後你再改藍圖或重新產出，學員看到的都不會變，直到再次發布。
              </p>
              <div className="mt-5">
                <Button onClick={() => setDialog("publish")}>發布給學員</Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm">
                上次發布：<span className="font-bold text-navy">{formatDateTime(pub.publishedAt)}</span>
              </p>

              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-bold text-body-muted">學員看到的產物</h3>
                  <ul className="space-y-3 text-sm">
                    {publishableSeries(course).map((series) => {
                      const locked = course.artifacts.find(
                        (a) => a.kind === series.kind && a.day === series.day && pub.artifactIds.includes(a.id),
                      );
                      const ready = latestReadyArtifact(course, series.kind, series.day);
                      const newer = ready && (!locked || ready.version > locked.version) ? ready : null;
                      return (
                        <li key={`${series.kind}-${series.day}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-navy">{seriesLabel(series)}</span>
                            {locked ? (
                              <Badge tone="outline">v{locked.version}</Badge>
                            ) : (
                              <span className="text-xs text-body-muted">發布時還沒有可用的版本</span>
                            )}
                          </div>
                          {newer && (
                            <p className="mt-1 text-xs font-bold text-warning">
                              {locked
                                ? `有較新的 v${newer.version} 未發布，學員目前看到的還是 v${locked.version}`
                                : `已經有 v${newer.version} 了，重新發布後學員才看得到`}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-body-muted">鎖定的素材</h3>
                    {lockedMaterials.length === 0 ? (
                      <p className="text-sm text-body-muted">沒有素材</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {lockedMaterials.map((m) => (
                          <li key={m.id} className="break-words text-navy">
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-body-muted">鎖定的連結</h3>
                    {pub.links.length === 0 ? (
                      <p className="text-sm text-body-muted">沒有連結</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {pub.links.map((l) => (
                          <li key={l.url} className="break-words text-navy">
                            {l.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {linksChanged && (
                      <p className="mt-1 text-xs font-bold text-warning">這一場的連結改過了，重新發布後學員才看得到</p>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-sm">重新發布會把學員入口換成目前最新的產物、素材與連結。</p>
              <div className="mt-4">
                <Button onClick={() => setDialog("publish")}>重新發布</Button>
              </div>
            </>
          )}
        </section>

        {/* 學員入口 */}
        <section id="portal" aria-labelledby="portal-title" className="scroll-mt-6">
          <SectionTitle>
            <span id="portal-title">學員入口</span>
          </SectionTitle>
          <Card>
            <Facts
              items={[
                [
                  "頁面",
                  <a key="u" href={portalPath} target="_blank" rel="noreferrer" className="break-all font-bold underline underline-offset-2">
                    {portalPath}
                  </a>,
                ],
                ["狀態", <Badge key="b" tone={badge.tone}>{badge.label}</Badge>],
                ["有效期限", pub ? formatDateTime(portalExpiresAt(session)) : `發布後開始計算，預設課後 ${PORTAL_VALID_DAYS} 天`],
              ]}
            />
            <p className="mt-3 text-xs text-body-muted">
              預設到課後 {PORTAL_VALID_DAYS} 天失效，你可以延長或提前關閉。學員不需要帳號，打開這個頁面就能看。
            </p>
            <div className="mt-4">
              <CopyButton text={hydrated ? `${window.location.origin}${portalPath}` : portalPath}>複製連結</CopyButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {state === "closed" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    dispatch({ type: "portal/reopen", sessionId: session.id });
                    toast("學員入口已重新開放");
                  }}
                >
                  重新開放
                </Button>
              ) : (
                <Button variant="secondary" disabled={!pub} title={pub ? undefined : "發布後才能關閉"} onClick={() => setDialog("close")}>
                  提前關閉
                </Button>
              )}
              <Button variant="secondary" disabled={!pub} title={pub ? undefined : "發布後才能延長"} onClick={() => setDialog("extend")}>
                延長期限
              </Button>
            </div>
          </Card>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {/* 場次資訊與準備度 */}
          <section id="info" aria-labelledby="info-title" className="scroll-mt-6">
            <SectionTitle aside={<TextButton onClick={() => setDialog("info")}>編輯</TextButton>}>
              <span id="info-title">場次資訊</span>
            </SectionTitle>
            <Card>
              <p className="mb-3 text-xs text-body-muted">每一天對應藍圖的同一天，各有日期、地點與授課講師。</p>
              <SessionDays session={session} />
              {dayMismatch && (
                <p role="alert" className="mt-3 text-sm font-bold text-warning">
                  這個場次排了 {dayMismatch.sessionDays} 天，藍圖是 {dayMismatch.blueprintDays} 天。時程不同的版本請另開一門課程。
                </p>
              )}
            </Card>
          </section>

          <section id="ready" aria-labelledby="ready-title" className="scroll-mt-6">
            <SectionTitle>
              <span id="ready-title">準備度</span>
            </SectionTitle>
            <Card>
              {items.length === 0 ? (
                <Badge tone="success">準備好了</Badge>
              ) : (
                <ReadinessList session={session} items={items} detailed />
              )}
            </Card>
          </section>
        </div>

        {/* 連結 */}
        <section id="links" aria-labelledby="links-title" className="scroll-mt-6">
          <SectionTitle>
            <span id="links-title">這一場的連結</span>
          </SectionTitle>
          <Card>
            <p className="mb-3 text-xs text-body-muted">連結屬於場次，每一場各自填，例如這一場專用的 Slido。</p>
            {session.links.length === 0 ? (
              <Empty>這一場還沒有連結。填上 Slido 之類的外部連結，發布後學員才找得到。</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {session.links.map((l) => (
                  <li key={l.url} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 hover:underline">
                      <span className="font-bold text-navy">{l.label}</span>
                      <span className="ml-3 break-all text-body-muted">{l.url}</span>
                    </a>
                    <TextButton
                      tone="danger"
                      onClick={() => {
                        dispatch({ type: "link/remove", sessionId: session.id, url: l.url });
                        toast(pub ? `已移除「${l.label}」，重新發布後學員那邊才會拿掉` : `已移除「${l.label}」`);
                      }}
                    >
                      移除
                    </TextButton>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setDialog("link")}>
                新增連結
              </Button>
            </div>
          </Card>
        </section>
      </div>

      {/* 對話框只在打開時掛載，每次打開都是乾淨的表單 */}
      {dialog === "publish" && <PublishDialog st={st} session={session} course={course} onClose={closeDialog} />}
      {dialog === "close" && (
        <Dialog
          open
          onClose={closeDialog}
          title="提前關閉學員入口？"
          description={
            <>
              關閉後，學員打開 <span className="font-bold text-navy">{portalPath}</span> 只會看到「講師已關閉這個頁面」。之後可以再重新開放。
            </>
          }
          submitLabel="關閉學員入口"
          onSubmit={() => {
            dispatch({ type: "portal/close", sessionId: session.id });
            toast("學員入口已關閉");
            closeDialog();
          }}
        />
      )}
      {dialog === "extend" && <ExtendDialog st={st} session={session} onClose={closeDialog} />}
      {dialog === "link" && <AddLinkDialog session={session} onClose={closeDialog} />}
      {dialog === "info" && <EditDaysDialog session={session} onClose={closeDialog} />}
    </>
  );
}

// ── 發布 ──────────────────────────────────────────────

function PublishDialog({ st, session, course, onClose }: { st: DemoState; session: Session; course: Course; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const portalPath = `/s/${session.portal.code}`;

  if (done) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="已發布給學員"
        description="學員入口已經換成剛剛鎖定的內容。可以開新分頁看看學員看到什麼；之後在這裡關閉或重新發布，學員分頁會跟著更新。"
      >
        <a href={portalPath} target="_blank" rel="noreferrer" className={NEW_TAB_LINK}>
          在新分頁開啟學員入口
        </a>
      </Dialog>
    );
  }

  // 與 reducer 的 session/publish 同一套規則：每一份可發布的產物鎖定最新的可用版本，還在產出中的不算
  const rows = publishableSeries(course).map((series) => {
    const ready = latestReadyArtifact(course, series.kind, series.day);
    const latest = latestArtifact(course, series.kind, series.day);
    const inProgress = latest && (latest.status === "pending" || latest.status === "generating") ? latest : null;
    return { series, ready, inProgress };
  });
  const inProgress = rows.filter((r) => r.inProgress);
  const republish = session.publication !== null;
  const closed = portalState(session, st.now) === "closed";

  return (
    <Dialog
      open
      onClose={onClose}
      title={republish ? "重新發布給學員？" : "發布給學員？"}
      description="學員入口會鎖定下面這些內容。之後再改藍圖或重新產出，學員看到的都不會變，直到再次發布。"
      submitLabel={republish ? "重新發布" : "發布"}
      onSubmit={() => {
        dispatch({ type: "session/publish", sessionId: session.id });
        toast(republish ? "已重新發布" : "已發布給學員");
        setDone(true);
      }}
    >
      {inProgress.length > 0 && (
        <p className="text-sm font-bold text-warning">
          {inProgress.map((r) => `${seriesLabel(r.series)} v${r.inProgress!.version}`).join("、")}
          還在產出中，這次不會帶到。產完後要再發布一次，學員才看得到。
        </p>
      )}
      <div>
        <h3 className="mb-1.5 text-xs font-bold text-body-muted">產物</h3>
        <ul className="space-y-1.5 text-sm">
          {rows.map(({ series, ready }) => (
            <li key={`${series.kind}-${series.day}`} className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-navy">{seriesLabel(series)}</span>
              {ready ? (
                <>
                  <Badge tone="outline">v{ready.version}</Badge>
                  {isStale(course, ready) && <span className="text-xs font-bold text-warning">已過期</span>}
                </>
              ) : (
                <span className="text-xs text-body-muted">還沒有可用的版本</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-body-muted">講師準備單只給你自己看，不會發布給學員。</p>
      </div>
      <div>
        <h3 className="mb-1.5 text-xs font-bold text-body-muted">課程素材</h3>
        {course.materials.length === 0 ? (
          <p className="text-sm text-body-muted">沒有素材</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {course.materials.map((m) => (
              <li key={m.id} className="break-words text-navy">
                {m.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-1.5 text-xs font-bold text-body-muted">這一場的連結</h3>
        {session.links.length === 0 ? (
          <p className="text-sm text-body-muted">沒有連結</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {session.links.map((l) => (
              <li key={l.url} className="break-words text-navy">
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {closed && <p className="text-sm">學員入口目前是關閉的，重新發布會一併重新開放。</p>}
    </Dialog>
  );
}

// ── 延長期限 ──────────────────────────────────────────

const EXTEND_OPTIONS = [7, 14, 30];

function ExtendDialog({ st, session, onClose }: { st: DemoState; session: Session; onClose: () => void }) {
  const [days, setDays] = useState(EXTEND_OPTIONS[0]);
  const current = portalExpiresAt(session);
  const next = addMs(current, days * DAY_MS);
  const stillExpired = new Date(next).getTime() < new Date(st.now).getTime();

  return (
    <Dialog
      open
      onClose={onClose}
      title="延長學員入口期限"
      description={
        <>
          目前到 <span className="font-bold text-navy">{formatDateTime(current)}</span>。
        </>
      }
      submitLabel="延長"
      onSubmit={() => {
        dispatch({ type: "portal/extend", sessionId: session.id, days });
        toast(`已延長 ${days} 天，到 ${formatDateTime(next)}`);
        onClose();
      }}
    >
      <Field label="延長多久">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {EXTEND_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} 天
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm">
        延長後到 <span className="font-bold text-navy">{formatDateTime(next)}</span>
      </p>
      {stillExpired && <p className="text-sm font-bold text-warning">延長後仍然已過期，可以再多延長一些。</p>}
    </Dialog>
  );
}

// ── 新增連結 ──────────────────────────────────────────

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function AddLinkDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [label, setLabel] = useState("Slido");
  const [url, setUrl] = useState("");
  const trimmedUrl = url.trim();
  const valid = isHttpUrl(trimmedUrl);
  const duplicate = session.links.some((l) => l.url === trimmedUrl);
  const urlHint =
    trimmedUrl && !valid ? (
      <span className="font-bold text-danger">請填完整網址，開頭是 https://</span>
    ) : duplicate ? (
      <span className="font-bold text-danger">這個連結已經加過了</span>
    ) : (
      "例如 https://app.sli.do/event/…"
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title="新增連結"
      description="這個連結只屬於這一場。發布後學員入口才看得到。"
      submitLabel="新增"
      submitDisabled={!label.trim() || !valid || duplicate}
      onSubmit={() => {
        dispatch({ type: "link/add", sessionId: session.id, label: label.trim(), url: trimmedUrl });
        toast(session.publication ? `已新增「${label.trim()}」，重新發布後學員才看得到` : `已新增「${label.trim()}」`);
        onClose();
      }}
    >
      <Field label="名稱">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} required />
      </Field>
      <Field label="網址" hint={urlHint}>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" placeholder="https://" required />
      </Field>
    </Dialog>
  );
}

// ── 編輯場次的每一天 ──────────────────────────────────

/** 場次時間一律以台北時間編輯 */
function taipeiParts(t: IsoTime): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

const toIso = (date: string, time: string): IsoTime => `${date}T${time}:00+08:00`;

interface DayDraft {
  date: string;
  start: string;
  end: string;
  venue: string;
  instructorId: string;
}

const toDraft = (d: SessionDay): DayDraft => {
  const s = taipeiParts(d.startsAt);
  return { date: s.date, start: s.time, end: taipeiParts(d.endsAt).time, venue: d.venue ?? "", instructorId: d.instructorId };
};

/** 一天的問題；沒問題回傳 null。日期要比前一天晚，避免兩天排在同一天或順序顛倒。 */
function dayProblem(d: DayDraft, prev: DayDraft | undefined): string | null {
  if (!d.date || !d.start || !d.end) return "日期與時間都要填";
  if (d.end <= d.start) return "結束要晚於開始時間";
  if (prev?.date && d.date <= prev.date) return "日期要晚於前一天";
  return null;
}

/** 天數不能在這裡改：場次的天數要跟藍圖一致，時程不同的版本另開一門課程。每一天的授課講師保留原樣。 */
function EditDaysDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [days, setDays] = useState<DayDraft[]>(() => session.days.map(toDraft));
  const multi = days.length > 1;
  const problems = days.map((d, i) => dayProblem(d, days[i - 1]));
  const update = (i: number, patch: Partial<DayDraft>) => setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <Dialog
      open
      onClose={onClose}
      title="編輯場次資訊"
      description={
        <>
          {multi ? "每一天的日期、時間與地點。" : "日期、時間與地點。"}天數跟藍圖一致，不能在這裡增減。
          {session.publication && " 學員入口上的時間與地點會立刻更新，不用重新發布。"}
        </>
      }
      submitLabel="儲存"
      submitDisabled={problems.some((p) => p !== null)}
      onSubmit={() => {
        dispatch({
          type: "session/updateDays",
          sessionId: session.id,
          days: days.map((d) => ({
            startsAt: toIso(d.date, d.start),
            endsAt: toIso(d.date, d.end),
            venue: d.venue.trim() || null,
            instructorId: d.instructorId,
          })),
        });
        toast("已更新場次資訊");
        onClose();
      }}
    >
      {days.map((d, i) => (
        <fieldset key={i} className={multi ? "space-y-3 border-t-2 border-iced pt-3 first:border-t-0 first:pt-0" : "space-y-3"}>
          {multi && (
            <legend className="float-left mb-1 w-full text-sm font-bold text-navy">
              第 {i + 1} 天
              <span className="ml-2 text-xs font-normal text-body-muted">授課 {getInstructor(d.instructorId)?.name ?? d.instructorId}</span>
            </legend>
          )}
          <Field label="日期">
            <TextInput type="date" value={d.date} onChange={(e) => update(i, { date: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始">
              <TextInput type="time" value={d.start} onChange={(e) => update(i, { start: e.target.value })} required />
            </Field>
            <Field label="結束">
              <TextInput type="time" value={d.end} onChange={(e) => update(i, { end: e.target.value })} required />
            </Field>
          </div>
          {problems[i] && <p className="text-xs font-bold text-danger">{problems[i]}</p>}
          <Field label="地點" hint="還沒定可以先留空">
            <TextInput value={d.venue} onChange={(e) => update(i, { venue: e.target.value })} placeholder={VENUE_UNSET} />
          </Field>
        </fieldset>
      ))}
    </Dialog>
  );
}
