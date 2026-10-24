import { BlueprintSchema, DEFAULT_SLOT_MINUTES, type Blueprint, type UnitSource } from "@/lib/blueprint/schema";
import { closingGate, isCourseClosed } from "./closing";
import { CURRENT_INSTRUCTOR_ID } from "./instructor";
import {
  artifactSeries,
  generationGate,
  getIndustryPack,
  getModuleCard,
  instructorEdit,
  isPublishable,
  latestArtifact,
  latestBlueprintVersion,
  latestModuleCardVersion,
  latestReadyArtifact,
  moduleLabel,
  portalExpiresAt,
} from "./logic";
import type { DemoState } from "./state";
import { defaultCourseTags, uniqueTags } from "./tags";
import { MODULES } from "./types";
import type {
  ArtifactKind,
  ClientContext,
  ClientDocumentKind,
  Course,
  CourseRecipe,
  DraftProposal,
  IndustryPack,
  TagSet,
  IsoTime,
  KnowledgeDraft,
  ModuleCard,
  ModuleId,
  ProjectStatus,
  Session,
  SessionDay,
  UnitCard,
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
  /**
   * moduleIds 是所選的模組（A 可多個、B 建議 1 個），藍圖依 MODULES 的順序接續各模組卡的核心單元骨架出生；
   * 空陣列就從零開始。totalHours 是課程總時數（小時），藍圖的總長就是它（規格由總時數推得，不另存）。
   * 組課提醒（composition.ts）只提醒、不擋建立，所以這裡不檢查。
   */
  | { type: "course/create"; id: string; projectId: string; title: string; moduleIds: ModuleId[]; totalHours: number; industryPackId: string | null; tags?: TagSet }
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
  | { type: "course/close"; courseId: string }
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
  /**
   * newId：收進新課程配方或新產業素材包時的 id（配方的單元卡會以它為前綴，例如 `${newId}-u1`）；
   * 模組卡升版時不用。
   */
  | { type: "draft/accept"; draftId: string; newId: string }
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
      const moduleCards = chosenModuleCards(st, action.moduleIds);
      const industryPack = action.industryPackId ? getIndustryPack(st, action.industryPackId) : undefined;
      // 標籤：講師開課時挑的；沒挑就帶入產業素材包的標籤（多選的值去掉重複）
      const picked = action.tags ?? defaultCourseTags(industryPack);
      const course: Course = {
        id: action.id,
        projectId: project.id,
        title: action.title,
        audiences: uniqueTags(picked.audiences),
        tools: uniqueTags(picked.tools),
        industries: uniqueTags(picked.industries),
        scenarios: uniqueTags(picked.scenarios),
        source: moduleCards.length > 0 && industryPack ? { moduleIds: moduleCards.map((c) => c.moduleId), industryPackId: industryPack.id } : null,
        copiedFrom: null,
        closedAt: null,
        blueprint: starterBlueprint({ title: action.title, clientContext: project.clientContext, moduleCards, unitCards: st.unitCards, industryPack, totalHours: action.totalHours }),
        blueprintHistory: [
          {
            version: 1,
            createdAt: now,
            note:
              moduleCards.length > 0
                ? `從模組卡${moduleCards.map((c) => `「${moduleLabel(c.moduleId)}」v${latestModuleCardVersion(c)}`).join("、")} 複製出生`
                : "從零開始的藍圖草稿",
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

    case "course/close": {
      const course = findCourse(action.courseId);
      // 結案閘沒過、或已經結案：不動（closedAt 保留第一次結案的時間）
      if (!course || isCourseClosed(course) || !closingGate(st, course, now).canClose) return state;
      return mapCourse(course.id, (c) => ({ ...c, closedAt: now }));
    }

    case "session/create": {
      const course = findCourse(action.courseId);
      // 結案後不能再新增場次；要再開同樣的課，複製課程
      if (!course || isCourseClosed(course) || action.days.length === 0) return state;
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
    }

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
      if (p.kind === "module_card_version") {
        const card = getModuleCard(st, p.moduleId);
        if (!card) return state;
        const next: ModuleCard = {
          ...card,
          versions: [
            ...card.versions,
            { version: latestModuleCardVersion(card) + 1, createdAt: now, note: p.changes.join("；"), fromCourseId: draft.fromCourseId },
          ],
        };
        return withoutDraft({ ...st, moduleCards: st.moduleCards.map((c) => (c.moduleId === card.moduleId ? next : c)) }, draft.id);
      }
      if (p.kind === "new_course_recipe") {
        // 單元卡依提案的順序編號：newId-u1、newId-u2…；配方照同一組 id 引用它們
        const unitCards: UnitCard[] = p.unitCards.map((u, i) => ({ ...u, id: `${action.newId}-u${i + 1}` }));
        const recipe: CourseRecipe = { ...p.recipe, id: action.newId, unitIds: unitCards.map((u) => u.id) };
        return withoutDraft({ ...st, unitCards: [...st.unitCards, ...unitCards], recipes: [...st.recipes, recipe] }, draft.id);
      }
      const industryPack: IndustryPack = { ...p.industryPack, id: action.newId };
      return withoutDraft({ ...st, industryPacks: [...st.industryPacks, industryPack] }, draft.id);
    }

    case "draft/discard":
      return withoutDraft(st, action.draftId);
  }
}

/** 新場次的第一天預設值：講師是自己、地點未定 */
export function newSessionDay(startsAt: IsoTime, endsAt: IsoTime, venue: string | null = null): SessionDay {
  return { startsAt, endsAt, venue, instructorId: CURRENT_INSTRUCTOR_ID };
}

/** 所選模組的模組卡：去掉重複與沒有模組卡的，依 MODULES 的順序排（A 在前、B 在後），不看選的先後。 */
export function chosenModuleCards(st: Pick<DemoState, "moduleCards">, moduleIds: ModuleId[]): ModuleCard[] {
  return MODULES.flatMap((m) => {
    const card = moduleIds.includes(m.id) ? st.moduleCards.find((c) => c.moduleId === m.id) : undefined;
    return card ? [card] : [];
  });
}

/** 把 list 依序切成 n 份，前面的份多拿一個（n ≤ list.length） */
function splitInto<T>(list: T[], n: number): T[][] {
  const base = Math.floor(list.length / n);
  const extra = list.length % n;
  let at = 0;
  return Array.from({ length: n }, (_, i) => {
    const size = base + (i < extra ? 1 : 0);
    const part = list.slice(at, at + size);
    at += size;
    return part;
  });
}

/** 把 total 平分成 n 份，餘數落在最後一份，加總永遠等於 total */
function splitMinutes(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

/**
 * 新課程的第一版藍圖：依 ADR 0002，從模組卡與產業素材包「複製內容」出生，之後各自演化。
 * 所選模組卡依 MODULES 順序接續，每張的核心單元骨架依序查出單元卡，每個單元記下來源
 * （kind 為 unit_card，指向那張單元卡）、所屬模組（單元卡的模組），沿用程度「要改」；
 * 應用層級單元卡還沒有，先留 null 讓講師與 AI 談。
 * 總長就是 totalHours（預設 6 小時，規格由總時數推得、不另存）：時段一律 180 分鐘（不足一段的短講座例外）、
 * 一天兩個時段；單元依序分進時段，單元不夠排的時段補一個「待規劃」單元（新做、不記來源）。
 * 查不到任何單元卡時，退回一個預設單元、標成新做、不記來源；schema 要求單元一定有模組，
 * 所以歸在所選的第一個模組，沒選模組才歸 B1 流程診斷（它的第一堂就是需求盤點）。
 * 刻意留下缺的五元素與待確認事項，讓講師接著跟 AI 談。客戶的 IT 限制複製進限制。
 */
export function starterBlueprint({
  title,
  clientContext,
  moduleCards = [],
  unitCards = [],
  industryPack,
  totalHours = 6,
}: {
  title: string;
  clientContext: ClientContext;
  /** 所選模組的模組卡，順序由 chosenModuleCards 決定（通常傳它的結果） */
  moduleCards?: ModuleCard[];
  /** 用來查骨架單元的單元卡（通常傳 st.unitCards） */
  unitCards?: UnitCard[];
  industryPack?: IndustryPack;
  /** 課程總時數（小時） */
  totalHours?: number;
}): Blueprint {
  // 各模組卡的骨架依序查出單元卡；查不到的 id 略過
  const cards = moduleCards.flatMap((mc) => mc.skeletonUnitIds.map((id) => unitCards.find((u) => u.id === id)).filter((u): u is UnitCard => u !== undefined));
  const entries: { title: string; module: ModuleId; source: UnitSource | null }[] =
    cards.length > 0
      ? cards.map((u) => ({ title: u.title, module: u.moduleId, source: { kind: "unit_card", id: u.id, version: null, unit: u.title } }))
      : [{ title: "開場與需求盤點", module: moduleCards[0]?.moduleId ?? "B1", source: null }];
  const totalMinutes = Math.round(totalHours * 60);
  // 時段一律 DEFAULT_SLOT_MINUTES；不足一段的短講座只有一段、長度就是總長；最後不整除的餘數成為最後一段
  const slotMinutes: number[] =
    totalMinutes < DEFAULT_SLOT_MINUTES
      ? [totalMinutes]
      : Array.from({ length: Math.ceil(totalMinutes / DEFAULT_SLOT_MINUTES) }, (_, i) => Math.min(DEFAULT_SLOT_MINUTES, totalMinutes - i * DEFAULT_SLOT_MINUTES));
  // 單元比時段多就依序平分；比時段少就一段一個，剩下的時段補待規劃單元（模組沿用前一個單元），讓講師看得到還要排
  let groups: typeof entries[];
  if (entries.length >= slotMinutes.length) {
    groups = splitInto(entries, slotMinutes.length);
  } else {
    const last = entries[entries.length - 1];
    groups = slotMinutes.map((_, i) => (i < entries.length ? [entries[i]] : [{ title: "待規劃", module: last.module, source: null }]));
  }
  // 一天最多兩個時段：上午、下午
  const dayGroups = Array.from({ length: Math.ceil(slotMinutes.length / 2) }, (_, d) => groups.map((g, i) => ({ group: g, minutes: slotMinutes[i] })).slice(d * 2, d * 2 + 2));
  const slotLabels = ["上午", "下午"];
  const theme = (day: typeof dayGroups[number]) => {
    if (moduleCards.length === 0) return title;
    const ids = [...new Set(day.flatMap((s) => s.group.map((e) => e.module)))];
    return ids.map(moduleLabel).join("＋");
  };
  const summaries = moduleCards.map((c) => c.summary);

  return BlueprintSchema.parse({
    title,
    oneLiner:
      moduleCards.length === 1
        ? moduleCards[0].summary
        : moduleCards.length > 1
          ? `為${clientContext.company}結合${moduleCards.map((c) => moduleLabel(c.moduleId)).join("、")}的課程，內容還在跟 AI 談。`
          : `為${clientContext.company}量身設計的課程，內容還在跟 AI 談。`,
    audience: {
      who: industryPack ? `${clientContext.company}的${industryPack.audiences.join("、")}` : `${clientContext.company}的學員`,
      size: null,
      priorKnowledge: "待確認",
      painPoints: [clientContext.goal],
    },
    outcomes: [clientContext.goal],
    format: { mode: "workshop", venue: null },
    narrative: { model: "SCQA", arc: ["情境", "衝突", "提問", "解答"] },
    elements: {
      theory: summaries,
      handsOn: industryPack?.cases.slice(0, 1) ?? [],
      takeaway: [],
      quote: [],
      story: [],
    },
    days: dayGroups.map((day) => ({
      theme: theme(day),
      slots: day.map(({ group, minutes: slotMin }, i) => {
        const unitMinutes = splitMinutes(slotMin, group.length);
        return {
          label: slotLabels[i] ?? `第 ${i + 1} 段`,
          minutes: slotMin,
          units: group.map(({ title: t, module, source }, k) => ({
            title: t,
            minutes: unitMinutes[k],
            module,
            level: null,
            objective: `完成「${t}」的練習`,
            method: "講述＋示範",
            outcome: "待跟 AI 談",
            keyPoints: ["待跟 AI 談"],
            activity: null,
            elements: [],
            carriesFrom: null,
            source,
            reuse: source ? "modify" : "new",
          })),
        };
      }),
    })),
    constraints: [...clientContext.itConstraints],
    tools: [],
    openQuestions: [
      { text: "學員人數與先備知識？", audience: "client", unit: null },
      { text: "學員要帶走什麼工具或清單？", audience: "self", unit: null },
    ],
  });
}
