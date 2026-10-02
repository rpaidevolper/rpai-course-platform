import { BlueprintSchema, DEFAULT_SLOT_MINUTES, type Blueprint } from "@/lib/blueprint/schema";
import { CURRENT_INSTRUCTOR_ID } from "./instructor";
import {
  artifactSeries,
  generationGate,
  getFramework,
  getScenario,
  instructorEdit,
  isPublishable,
  latestArtifact,
  latestBlueprintVersion,
  latestFrameworkVersion,
  latestReadyArtifact,
  portalExpiresAt,
} from "./logic";
import type { DemoState } from "./state";
import type {
  ArtifactKind,
  ClientContext,
  ClientDocumentKind,
  Course,
  DraftProposal,
  Framework,
  IsoTime,
  KnowledgeDraft,
  ProjectStatus,
  Scenario,
  Session,
  SessionDay,
} from "./types";

/**
 * 可互動 demo（#48）的所有狀態改動。reducer 是純函式：
 * 新 id、學員入口代碼由呼叫端產生後放進 action（UI 用 makeId），方便測試。
 * 時間一律讀 state.now；每個 action 先把 demo 時鐘推一分鐘，讓時間戳有先後。
 * 不合規則的 action（例如定稿閘擋住的產檔）回傳原狀態，不丟例外；UI 本來就不該讓人按。
 */
export type DemoAction =
  // 專案
  | { type: "project/create"; id: string; title: string; priceTwd: number; status: ProjectStatus; clientContext: ClientContext }
  | { type: "project/update"; projectId: string; title: string; priceTwd: number; status: ProjectStatus; clientContext: ClientContext }
  | { type: "clientDocument/add"; projectId: string; id: string; kind: ClientDocumentKind; title: string; fileName: string }
  // 課程與藍圖
  | { type: "course/create"; id: string; projectId: string; title: string; frameworkId: string | null; scenarioId: string | null }
  | { type: "blueprint/revise"; courseId: string; blueprint: Blueprint; note: string }
  | { type: "blueprint/finalize"; courseId: string }
  // 產物
  | { type: "artifact/request"; id: string; courseId: string; kind: ArtifactKind; day: number | null }
  /** 只在產物目前是 from 狀態時才推進，多個分頁同時跑計時器也不會跳級 */
  | { type: "artifact/advance"; courseId: string; artifactId: string; from: "pending" | "generating" }
  | { type: "artifact/finalize"; courseId: string; artifactId: string }
  | { type: "artifact/uploadEdit"; courseId: string; baseId: string; id: string }
  | { type: "artifact/markSent"; courseId: string; artifactId: string }
  // 素材
  | { type: "material/add"; id: string; courseId: string; name: string; sizeKb: number }
  | { type: "material/remove"; courseId: string; materialId: string }
  // 場次
  | { type: "session/create"; id: string; courseId: string; days: SessionDay[]; portalCode: string }
  | { type: "session/updateDays"; sessionId: string; days: SessionDay[] }
  | { type: "link/add"; sessionId: string; label: string; url: string }
  | { type: "link/remove"; sessionId: string; url: string }
  | { type: "session/publish"; sessionId: string }
  | { type: "portal/close"; sessionId: string }
  | { type: "portal/reopen"; sessionId: string }
  | { type: "portal/extend"; sessionId: string; days: number }
  // 知識庫
  | { type: "draft/import"; id: string; fileName: string; proposal: DraftProposal }
  /** newId：收進新框架或新情境時的 id；升版時不用 */
  | { type: "draft/accept"; draftId: string; newId: string }
  | { type: "draft/saveAsFramework"; draftId: string; frameworkId: string; title: string }
  | { type: "draft/discard"; draftId: string };

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** 維持 +08:00 的 ISO 字串，跟 fixture 同格式 */
export function addMs(t: IsoTime, delta: number): IsoTime {
  const d = new Date(new Date(t).getTime() + delta + 8 * 60 * MINUTE_MS);
  return d.toISOString().replace(/\.\d{3}Z$/, "+08:00");
}

/** UI 用：產生新 id。reducer 不自己產生 id，保持純函式。 */
export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 學員入口代碼：短、好唸，不含容易看錯的字 */
export function makePortalCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const st: DemoState = { ...state, now: addMs(state.now, MINUTE_MS) };
  const now = st.now;

  const mapCourse = (id: string, fn: (c: Course) => Course): DemoState => ({
    ...st,
    courses: st.courses.map((c) => (c.id === id ? fn(c) : c)),
  });
  const mapSession = (id: string, fn: (s: Session) => Session): DemoState => ({
    ...st,
    sessions: st.sessions.map((s) => (s.id === id ? fn(s) : s)),
  });
  const withoutDraft = (s: DemoState, id: string): DemoState => ({ ...s, drafts: s.drafts.filter((d) => d.id !== id) });
  const findCourse = (id: string) => st.courses.find((c) => c.id === id);

  switch (action.type) {
    case "project/create":
      return {
        ...st,
        projects: [
          ...st.projects,
          {
            id: action.id,
            title: action.title,
            status: action.status,
            priceTwd: action.priceTwd,
            clientContext: action.clientContext,
            clientDocuments: [],
            requirements: [],
          },
        ],
      };

    case "project/update":
      return {
        ...st,
        projects: st.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, title: action.title, priceTwd: action.priceTwd, status: action.status, clientContext: action.clientContext }
            : p,
        ),
      };

    case "clientDocument/add":
      return {
        ...st,
        projects: st.projects.map((p) =>
          p.id === action.projectId
            ? {
                ...p,
                clientDocuments: [
                  ...p.clientDocuments,
                  { id: action.id, kind: action.kind, title: action.title, fileName: action.fileName, receivedAt: now, respondsToOutlineId: null },
                ],
              }
            : p,
        ),
      };

    case "course/create": {
      const project = st.projects.find((p) => p.id === action.projectId);
      if (!project) return state;
      const framework = action.frameworkId ? getFramework(st, action.frameworkId) : undefined;
      const scenario = action.scenarioId ? getScenario(st, action.scenarioId) : undefined;
      const course: Course = {
        id: action.id,
        projectId: project.id,
        title: action.title,
        source:
          framework && scenario
            ? { frameworkId: framework.id, frameworkVersion: latestFrameworkVersion(framework), scenarioId: scenario.id }
            : null,
        copiedFrom: null,
        blueprint: starterBlueprint({ title: action.title, clientContext: project.clientContext, framework, scenario }),
        blueprintHistory: [
          {
            version: 1,
            createdAt: now,
            note: framework ? `從框架「${framework.title}」v${latestFrameworkVersion(framework)} 複製出生` : "從零開始的藍圖草稿",
            finalizedAt: null,
          },
        ],
        artifacts: [],
        materials: [],
      };
      return { ...st, courses: [...st.courses, course] };
    }

    case "blueprint/revise": {
      const blueprint = BlueprintSchema.parse(action.blueprint);
      return mapCourse(action.courseId, (c) => ({
        ...c,
        blueprint,
        blueprintHistory: [
          ...c.blueprintHistory,
          { version: latestBlueprintVersion(c) + 1, createdAt: now, note: action.note, finalizedAt: null },
        ],
      }));
    }

    case "blueprint/finalize":
      return mapCourse(action.courseId, (c) => {
        const latest = latestBlueprintVersion(c);
        return {
          ...c,
          blueprintHistory: c.blueprintHistory.map((v) => (v.version === latest && v.finalizedAt === null ? { ...v, finalizedAt: now } : v)),
        };
      });

    case "artifact/request": {
      const course = findCourse(action.courseId);
      if (!course) return state;
      const job = { kind: action.kind, day: action.day };
      if (generationGate(course, job).length > 0) return state;
      const busy = latestArtifact(course, action.kind, action.day);
      if (busy && (busy.status === "pending" || busy.status === "generating")) return state;
      // 上游：簡報 → 該天最新可用的逐頁腳本；學員手冊 → 每一天最新可用的逐頁腳本（定稿閘已保證都存在）
      const upstreamIds =
        action.kind === "slides"
          ? [latestReadyArtifact(course, "page_script", action.day)!.id]
          : action.kind === "handbook"
            ? course.blueprint.days.map((_, i) => latestReadyArtifact(course, "page_script", i + 1)!.id)
            : [];
      return mapCourse(course.id, (c) => ({
        ...c,
        artifacts: [
          ...c.artifacts,
          {
            id: action.id,
            kind: action.kind,
            day: action.day,
            version: (busy?.version ?? 0) + 1,
            blueprintVersion: latestBlueprintVersion(c),
            upstreamIds,
            editedFromId: null,
            sentToClientAt: null,
            finalizedAt: null,
            status: "pending",
            createdAt: now,
          },
        ],
      }));
    }

    case "artifact/advance":
      return mapCourse(action.courseId, (c) => ({
        ...c,
        artifacts: c.artifacts.map((a) => {
          if (a.id !== action.artifactId || a.status !== action.from) return a;
          return a.status === "pending" ? { ...a, status: "generating" } : { ...a, status: "ready", createdAt: now };
        }),
      }));

    case "artifact/finalize":
      return mapCourse(action.courseId, (c) => ({
        ...c,
        artifacts: c.artifacts.map((a) =>
          a.id === action.artifactId && a.kind === "page_script" && a.status === "ready" && a.finalizedAt === null ? { ...a, finalizedAt: now } : a,
        ),
      }));

    case "artifact/uploadEdit": {
      const course = findCourse(action.courseId);
      if (!course || !course.artifacts.some((a) => a.id === action.baseId)) return state;
      const edited = instructorEdit(course, action.baseId, { id: action.id, createdAt: now });
      return mapCourse(course.id, (c) => ({ ...c, artifacts: [...c.artifacts, edited] }));
    }

    case "artifact/markSent":
      return mapCourse(action.courseId, (c) => ({
        ...c,
        artifacts: c.artifacts.map((a) =>
          a.id === action.artifactId && a.kind === "outline" && a.sentToClientAt === null ? { ...a, sentToClientAt: now } : a,
        ),
      }));

    case "material/add":
      return mapCourse(action.courseId, (c) => ({
        ...c,
        materials: [...c.materials, { id: action.id, name: action.name, sizeKb: action.sizeKb }],
      }));

    case "material/remove":
      return mapCourse(action.courseId, (c) => ({ ...c, materials: c.materials.filter((m) => m.id !== action.materialId) }));

    case "session/create":
      if (!findCourse(action.courseId) || action.days.length === 0) return state;
      return {
        ...st,
        sessions: [
          ...st.sessions,
          {
            id: action.id,
            courseId: action.courseId,
            days: action.days,
            links: [],
            publication: null,
            portal: { code: action.portalCode, closedAt: null, expiresAtOverride: null },
          },
        ],
      };

    case "session/updateDays":
      if (action.days.length === 0) return state;
      return mapSession(action.sessionId, (s) => ({ ...s, days: action.days }));

    case "link/add":
      return mapSession(action.sessionId, (s) =>
        s.links.some((l) => l.url === action.url) ? s : { ...s, links: [...s.links, { label: action.label, url: action.url }] },
      );

    case "link/remove":
      return mapSession(action.sessionId, (s) => ({ ...s, links: s.links.filter((l) => l.url !== action.url) }));

    case "session/publish":
      return mapSession(action.sessionId, (s) => {
        const course = findCourse(s.courseId);
        if (!course) return s;
        // 每一份可發布的產物（講師準備單除外）鎖定最新的可用版本；還在產出中的不算
        const artifactIds = artifactSeries(course)
          .filter((series) => isPublishable(series))
          .flatMap(({ kind, day }) => {
            const ready = latestReadyArtifact(course, kind, day);
            return ready ? [ready.id] : [];
          });
        return {
          ...s,
          publication: { publishedAt: now, artifactIds, materialIds: course.materials.map((m) => m.id), links: [...s.links] },
          // 重新發布視為重新打開學員入口
          portal: { ...s.portal, closedAt: null },
        };
      });

    case "portal/close":
      return mapSession(action.sessionId, (s) => ({ ...s, portal: { ...s.portal, closedAt: now } }));

    case "portal/reopen":
      return mapSession(action.sessionId, (s) => ({ ...s, portal: { ...s.portal, closedAt: null } }));

    case "portal/extend":
      return mapSession(action.sessionId, (s) => ({
        ...s,
        portal: { ...s.portal, expiresAtOverride: addMs(portalExpiresAt(s), action.days * DAY_MS) },
      }));

    case "draft/import": {
      const draft: KnowledgeDraft = {
        id: action.id,
        fromCourseId: null,
        importedFileName: action.fileName,
        createdAt: now,
        trigger: "import",
        proposal: action.proposal,
      };
      return { ...st, drafts: [draft, ...st.drafts] };
    }

    case "draft/accept": {
      const draft = st.drafts.find((d) => d.id === action.draftId);
      if (!draft) return state;
      const p = draft.proposal;
      if (p.kind === "framework_version") {
        const fw = getFramework(st, p.frameworkId);
        if (!fw) return state;
        const next: Framework = {
          ...fw,
          versions: [
            ...fw.versions,
            { version: latestFrameworkVersion(fw) + 1, createdAt: now, note: p.changes.join("；"), fromCourseId: draft.fromCourseId },
          ],
        };
        return withoutDraft({ ...st, frameworks: st.frameworks.map((f) => (f.id === fw.id ? next : f)) }, draft.id);
      }
      if (p.kind === "new_framework") {
        const note = draft.importedFileName ? `由匯入的講義「${draft.importedFileName}」整理` : "由課後草稿整理";
        const fw: Framework = { id: action.newId, ...p.framework, versions: [{ version: 1, createdAt: now, note, fromCourseId: draft.fromCourseId }] };
        return withoutDraft({ ...st, frameworks: [...st.frameworks, fw] }, draft.id);
      }
      const scenario: Scenario = { id: action.newId, ...p.scenario };
      return withoutDraft({ ...st, scenarios: [...st.scenarios, scenario] }, draft.id);
    }

    case "draft/saveAsFramework": {
      const draft = st.drafts.find((d) => d.id === action.draftId);
      if (!draft || draft.proposal.kind !== "framework_version") return state;
      const base = getFramework(st, draft.proposal.frameworkId);
      if (!base) return state;
      const fw: Framework = {
        id: action.frameworkId,
        topicId: base.topicId,
        title: action.title,
        summary: base.summary,
        moduleTitles: [...base.moduleTitles],
        versions: [{ version: 1, createdAt: now, note: draft.proposal.changes.join("；"), fromCourseId: draft.fromCourseId }],
      };
      return withoutDraft({ ...st, frameworks: [...st.frameworks, fw] }, draft.id);
    }

    case "draft/discard":
      return withoutDraft(st, action.draftId);
  }
}

/** 新場次的第一天預設值：講師是自己、地點未定 */
export function newSessionDay(startsAt: IsoTime, endsAt: IsoTime, venue: string | null = null): SessionDay {
  return { startsAt, endsAt, venue, instructorId: CURRENT_INSTRUCTOR_ID };
}

/**
 * 新課程的第一版藍圖：依 ADR 0002，從框架與情境「複製內容」出生，之後各自演化。
 * 框架的每個單元記下來源（框架 vN 的那個單元、沿用程度「要改」）；
 * 刻意留下缺的五元素與待確認事項，讓講師接著跟 AI 談。客戶的 IT 限制複製進限制。
 */
export function starterBlueprint({
  title,
  clientContext,
  framework,
  scenario,
}: {
  title: string;
  clientContext: ClientContext;
  framework?: Framework;
  scenario?: Scenario;
}): Blueprint {
  const fwVersion = framework ? latestFrameworkVersion(framework) : null;
  const unitTitles = framework?.moduleTitles.length ? framework.moduleTitles : ["開場與需求盤點"];
  // 一天兩個三小時的時段，單元平均分進上午與下午
  const half = Math.ceil(unitTitles.length / 2);
  const groups = unitTitles.length > 1 ? [unitTitles.slice(0, half), unitTitles.slice(half)] : [unitTitles];
  const slotLabels = ["上午", "下午"];

  return BlueprintSchema.parse({
    title,
    oneLiner: framework?.summary ?? `為${clientContext.company}量身設計的課程，內容還在跟 AI 談。`,
    audience: {
      who: scenario ? `${clientContext.company}的${scenario.audience}` : `${clientContext.company}的學員`,
      size: null,
      priorKnowledge: "待確認",
      painPoints: [clientContext.goal],
    },
    outcomes: [clientContext.goal],
    format: { mode: "workshop", venue: null },
    narrative: { model: "SCQA", arc: ["情境", "衝突", "提問", "解答"] },
    elements: {
      theory: framework ? [framework.summary] : [],
      handsOn: scenario?.cases.slice(0, 1) ?? [],
      takeaway: [],
      quote: [],
      story: [],
    },
    days: [
      {
        theme: framework?.title ?? title,
        slots: groups.map((titles, i) => {
          const minutes = Math.floor(DEFAULT_SLOT_MINUTES / titles.length);
          return {
            label: slotLabels[i] ?? `第 ${i + 1} 段`,
            minutes: minutes * titles.length,
            units: titles.map((t) => ({
              title: t,
              minutes,
              objective: `完成「${t}」的練習`,
              method: "講述＋示範",
              outcome: "待跟 AI 談",
              keyPoints: ["待跟 AI 談"],
              activity: null,
              elements: [],
              carriesFrom: null,
              source: framework && fwVersion ? { kind: "framework", id: framework.id, version: fwVersion, unit: t } : null,
              reuse: framework ? "modify" : "new",
            })),
          };
        }),
      },
    ],
    constraints: [...clientContext.itConstraints],
    tools: [],
    openQuestions: [
      { text: "學員人數與先備知識？", audience: "client", unit: null },
      { text: "學員要帶走什麼工具或清單？", audience: "self", unit: null },
    ],
  });
}
