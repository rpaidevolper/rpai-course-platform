import { describe, expect, it } from "vitest";
import { openItems } from "@/lib/blueprint/open-items";
import { BlueprintSchema, checkBlueprint } from "@/lib/blueprint/schema";
import {
  COURSES,
  FRAMEWORKS,
  KNOWLEDGE_DRAFTS,
  MOCK_NOW,
  PROJECTS,
  REQUIREMENT_REVIEWS,
  SESSIONS,
} from "./data";
import {
  coursesOfProject,
  gateBlockText,
  generationGate,
  getCourse,
  getProject,
  getSession,
  isStale,
  latestBlueprintVersion,
  latestArtifact,
  portalState,
  portalView,
  projectsByStatus,
  publicationProblems,
  requirementMappingOfCourse,
  unassignedRequirements,
  upcomingSessions,
} from "./logic";
import type { Course, Project, Session } from "./types";

const unitsOf = (c: Course) => c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units));

describe("設計稿 fixture 參照完整", () => {
  it.each(COURSES)("課程 $id 的藍圖通過 BlueprintSchema", (c) => {
    expect(() => BlueprintSchema.parse(c.blueprint)).not.toThrow();
  });

  it.each(COURSES)("課程 $id 每個時段的單元分鐘數都等於時段長度", (c) => {
    expect(checkBlueprint(c.blueprint).filter((i) => i.kind === "duration_mismatch")).toEqual([]);
  });

  it.each(COURSES)("課程 $id 的單元「承接自」都指向一個較早的單元", (c) => {
    const titles = c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units.map((u) => u.title)));
    titles.forEach((title, i) => {
      const unit = c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units))[i];
      if (unit.carriesFrom === null) return;
      expect(titles.filter((t) => t === unit.carriesFrom), `${title} 承接自 ${unit.carriesFrom}`).toHaveLength(1);
      expect(titles.indexOf(unit.carriesFrom)).toBeLessThan(i);
    });
  });

  it.each(COURSES)("課程 $id 的待確認事項若指向單元，該單元標題恰好存在一個", (c) => {
    const titles = c.blueprint.days.flatMap((d) => d.slots.flatMap((s) => s.units.map((u) => u.title)));
    for (const q of c.blueprint.openQuestions) {
      if (q.unit === null) continue;
      expect(titles.filter((t) => t === q.unit), q.text).toHaveLength(1);
    }
  });

  it("有課程示範問客戶事項掛在單元上、未確認工具、自己決定的事項", () => {
    const all = COURSES.flatMap((c) => openItems(c.blueprint));
    expect(all.some((i) => i.audience === "client" && i.unit !== null)).toBe(true);
    expect(all.some((i) => i.tool !== null)).toBe(true);
    expect(all.some((i) => i.audience === "self")).toBe(true);
  });

  it("有一門多天課程示範天 → 時段 → 單元：至少兩天、每天兩個時段，且有跨天承接", () => {
    const multiDay = getCourse("c-gas-two-day")!;
    expect(multiDay.blueprint.days.length).toBeGreaterThanOrEqual(2);
    for (const d of multiDay.blueprint.days) expect(d.slots).toHaveLength(2);
    const day1Titles = multiDay.blueprint.days[0].slots.flatMap((s) => s.units.map((u) => u.title));
    const day2Units = multiDay.blueprint.days[1].slots.flatMap((s) => s.units);
    expect(day2Units.some((u) => u.carriesFrom !== null && day1Titles.includes(u.carriesFrom))).toBe(true);
  });

  it("課程指向存在的專案、框架版本與情境", () => {
    for (const c of COURSES) {
      expect(PROJECTS.some((p) => p.id === c.projectId)).toBe(true);
      if (!c.source) continue;
      const f = FRAMEWORKS.find((x) => x.id === c.source!.frameworkId);
      expect(f?.versions.some((v) => v.version === c.source!.frameworkVersion)).toBe(true);
    }
  });

  it("複製來的課程指向同一個專案裡另一門課程的某一版藍圖", () => {
    for (const c of COURSES) {
      if (!c.copiedFrom) continue;
      const from = getCourse(c.copiedFrom.courseId);
      expect(from, `${c.id} 複製自 ${c.copiedFrom.courseId}`).toBeDefined();
      expect(from!.id).not.toBe(c.id);
      expect(from!.projectId).toBe(c.projectId);
      expect(from!.blueprintHistory.map((v) => v.version)).toContain(c.copiedFrom.blueprintVersion);
    }
  });

  it("有一門從同仁班複製出的主管班，單元混合沿用、要改與新做", () => {
    const managers = getCourse("c-claude-intro-managers")!;
    expect(managers.copiedFrom).toEqual({ courseId: "c-claude-intro", blueprintVersion: 3 });
    expect(new Set(unitsOf(managers).map((u) => u.reuse))).toEqual(new Set(["reuse", "modify", "new"]));
    for (const u of unitsOf(managers)) {
      if (u.source === null) continue;
      expect(u.source, u.title).toMatchObject({ kind: "course", id: "c-claude-intro", version: 3 });
    }
  });

  it.each(COURSES)("課程 $id 的單元來源都存在：課程版本或框架版本，以及其中的單元", (c) => {
    for (const u of unitsOf(c)) {
      if (u.source === null) continue;
      const src = u.source;
      if (src.kind === "course") {
        const from = getCourse(src.id);
        expect(from, `${u.title} 來源課程 ${src.id}`).toBeDefined();
        expect(from!.blueprintHistory.map((v) => v.version)).toContain(src.version);
        // 只存了最新一版藍圖的內容，所以只有指向最新版時才能核對單元標題
        if (src.version === latestBlueprintVersion(from!)) {
          expect(unitsOf(from!).map((x) => x.title), `${u.title} 來源單元`).toContain(src.unit);
        }
      } else {
        const f = FRAMEWORKS.find((x) => x.id === src.id);
        expect(f, `${u.title} 來源框架 ${src.id}`).toBeDefined();
        expect(f!.versions.map((v) => v.version)).toContain(src.version);
        expect(f!.moduleTitles, `${u.title} 來源單元`).toContain(src.unit);
      }
    }
  });

  it.each(COURSES)("課程 $id 的沿用程度與來源一致：沒有來源就是新做", (c) => {
    for (const u of unitsOf(c)) {
      if (u.source === null) expect(u.reuse, u.title).toBe("new");
      else expect(u.reuse, u.title).not.toBe("new");
    }
  });

  it("產物指向存在的藍圖版本", () => {
    for (const c of COURSES) {
      const versions = c.blueprintHistory.map((v) => v.version);
      for (const a of c.artifacts) expect(versions).toContain(a.blueprintVersion);
    }
  });

  it("產物 id 在所有課程間不重複；同一份產物的版本號不重複", () => {
    const ids = COURSES.flatMap((c) => c.artifacts.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COURSES) {
      const keys = c.artifacts.map((a) => `${a.kind}/${a.day}/${a.version}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it.each(COURSES)("課程 $id：逐頁腳本與簡報帶藍圖範圍內的天，其他產物不帶天", (c) => {
    for (const a of c.artifacts) {
      if (a.kind === "page_script" || a.kind === "slides") {
        expect(a.day, a.id).not.toBeNull();
        expect(a.day! >= 1 && a.day! <= c.blueprint.days.length, a.id).toBe(true);
      } else {
        expect(a.day, a.id).toBeNull();
      }
    }
  });

  it.each(COURSES)("課程 $id：上游都存在於同一門課程，且符合產物鏈", (c) => {
    const byId = (id: string) => c.artifacts.find((a) => a.id === id);
    for (const a of c.artifacts) {
      const ups = a.upstreamIds.map(byId);
      expect(ups.every(Boolean), a.id).toBe(true);
      if (a.kind === "slides") {
        expect(ups.map((u) => [u!.kind, u!.day]), a.id).toEqual([["page_script", a.day]]);
      } else if (a.kind === "handbook") {
        expect(ups.map((u) => [u!.kind, u!.day]), a.id).toEqual(
          c.blueprint.days.map((_, i) => ["page_script", i + 1]),
        );
      } else {
        expect(a.upstreamIds, a.id).toEqual([]);
      }
    }
  });

  it.each(COURSES)("課程 $id：講師修改的版本改自同一份產物的較早版本，並沿用它的綁定", (c) => {
    for (const a of c.artifacts) {
      if (a.editedFromId === null) continue;
      const original = c.artifacts.find((x) => x.id === a.editedFromId)!;
      expect(original, a.id).toBeDefined();
      expect([original.kind, original.day, original.blueprintVersion, original.upstreamIds]).toEqual([
        a.kind,
        a.day,
        a.blueprintVersion,
        a.upstreamIds,
      ]);
      expect(original.version).toBeLessThan(a.version);
    }
  });

  it("只有課程大綱會標已寄給客戶", () => {
    for (const a of COURSES.flatMap((c) => c.artifacts)) {
      if (a.kind !== "outline") expect(a.sentToClientAt, a.id).toBeNull();
    }
  });

  it("發布只鎖定同一門課程的產物與素材，且不含講師準備單", () => {
    for (const s of SESSIONS) {
      if (!s.publication) continue;
      expect(publicationProblems(getCourse(s.courseId)!, s.publication), s.id).toEqual([]);
    }
  });

  it("學員入口代碼不重複", () => {
    const codes = SESSIONS.map((s) => s.portal.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("知識庫草稿指向存在的課程", () => {
    for (const d of KNOWLEDGE_DRAFTS) expect(getCourse(d.fromCourseId)).toBeDefined();
  });
});

describe("產物過期（fixture 示範）", () => {
  it("出自舊版藍圖的產物算過期，出自最新版的不算", () => {
    const course = getCourse("c-claude-intro")!;
    expect(isStale(course, latestArtifact(course, "handbook")!)).toBe(true);
    expect(isStale(course, latestArtifact(course, "slides", 1)!)).toBe(false);
  });

  it("兩天課程只改了第一天逐頁腳本：第一天簡報與學員手冊過期，第二天簡報沒有", () => {
    const course = getCourse("c-gas-two-day")!;
    expect(isStale(course, latestArtifact(course, "slides", 1)!)).toBe(true);
    expect(isStale(course, latestArtifact(course, "handbook")!)).toBe(true);
    expect(isStale(course, latestArtifact(course, "slides", 2)!)).toBe(false);
  });
});

describe("定稿（fixture）", () => {
  const ms = (t: string) => new Date(t).getTime();

  it("只有逐頁腳本會標定稿，且定稿時間不晚於現在", () => {
    for (const a of COURSES.flatMap((c) => c.artifacts)) {
      if (a.kind !== "page_script") expect(a.finalizedAt, a.id).toBeNull();
      else if (a.finalizedAt) expect(ms(a.finalizedAt), a.id).toBeLessThanOrEqual(ms(MOCK_NOW));
    }
    for (const v of COURSES.flatMap((c) => c.blueprintHistory)) {
      if (v.finalizedAt) expect(ms(v.finalizedAt)).toBeLessThanOrEqual(ms(MOCK_NOW));
    }
  });

  it.each(COURSES)("課程 $id 的產物沒有違反定稿閘：產出時，綁定的藍圖版本與上游逐頁腳本都已定稿", (c) => {
    for (const a of c.artifacts) {
      if (a.editedFromId) continue; // 講師修改版沿用原版本的綁定，不是新排的產檔工作
      if (a.kind === "page_script") {
        const bp = c.blueprintHistory.find((v) => v.version === a.blueprintVersion)!;
        expect(bp.finalizedAt, a.id).not.toBeNull();
        expect(ms(bp.finalizedAt!), a.id).toBeLessThanOrEqual(ms(a.createdAt));
      }
      for (const id of a.upstreamIds) {
        const up = c.artifacts.find((x) => x.id === id)!;
        expect(up.finalizedAt, `${a.id} ← ${id}`).not.toBeNull();
        expect(ms(up.finalizedAt!), `${a.id} ← ${id}`).toBeLessThanOrEqual(ms(a.createdAt));
      }
    }
  });

  it("示範兩天課程：第 1 天簡報與學員手冊被沒定稿的第 1 天逐頁腳本擋住，第 2 天簡報可以排", () => {
    const course = getCourse("c-gas-two-day")!;
    expect(generationGate(course, { kind: "slides", day: 1 }).map(gateBlockText)).toEqual(["第 1 天逐頁腳本 v2 還沒定稿"]);
    expect(generationGate(course, { kind: "handbook", day: null }).map(gateBlockText)).toEqual(["第 1 天逐頁腳本 v2 還沒定稿"]);
    expect(generationGate(course, { kind: "slides", day: 2 })).toEqual([]);
    expect(generationGate(course, { kind: "page_script", day: 1 })).toEqual([]);
  });

  it("示範藍圖還沒定稿的課程：逐頁腳本被擋，課程大綱照樣可以排", () => {
    const course = getCourse("c-claude-intro-managers")!;
    expect(generationGate(course, { kind: "page_script", day: 1 }).map(gateBlockText)).toEqual(["藍圖 v1 還沒定稿"]);
    expect(generationGate(course, { kind: "outline", day: null })).toEqual([]);
  });
});

describe("講師首頁的場次", () => {
  it("只列還沒結束的場次，依開始時間排序", () => {
    expect(upcomingSessions(MOCK_NOW).map((s) => s.id)).toEqual(["s-ci-1015", "s-gas-1020", "s-ci-1022", "s-pa-1029", "s-ca-1105"]);
  });
});

describe("學員入口", () => {
  it("只顯示發布時鎖定的版本，不是課程最新的版本", () => {
    const view = portalView("a1015", MOCK_NOW)!;
    expect(view.state).toBe("open");
    expect(view.artifacts.map((a) => a.id)).toEqual(["a-ci-outline-1", "a-ci-slides-1", "a-ci-handbook-1"]);
  });

  it("不含專案與價格", () => {
    const json = JSON.stringify(portalView("a1015", MOCK_NOW));
    expect(json).not.toMatch(/price|360000|A 公司 2026 AI 培訓/);
  });

  it("欄位固定，新增欄位要先改這個測試（避免悄悄帶出專案或價格）", () => {
    expect(Object.keys(portalView("a1015", MOCK_NOW)!).sort()).toEqual(
      ["artifacts", "courseTitle", "day", "days", "expiresAt", "links", "materials", "state"],
    );
  });

  it("未發布時不給任何教材", () => {
    const view = portalView("a1022", MOCK_NOW)!;
    expect(view.state).toBe("unpublished");
    expect([...view.artifacts, ...view.materials, ...view.links]).toEqual([]);
  });

  it("課後 30 天失效，之後不給任何教材", () => {
    const s = getSession("s-pa-0918")!;
    expect(portalState(s, "2026-10-18T16:00:00+08:00")).toBe("open");
    expect(portalState(s, "2026-10-18T16:31:00+08:00")).toBe("expired");
    expect(portalView("b0918", "2026-10-19T00:00:00+08:00")!.artifacts).toEqual([]);
  });

  it("講師提前關閉後立即失效；延長後依延長的時間", () => {
    const base = getSession("s-pa-0918")!;
    const closed: Session = { ...base, portal: { ...base.portal, closedAt: "2026-10-01T00:00:00+08:00" } };
    expect(portalState(closed, MOCK_NOW)).toBe("closed");
    const extended: Session = { ...base, portal: { ...base.portal, expiresAtOverride: "2026-12-31T23:59:00+08:00" } };
    expect(portalState(extended, "2026-11-30T00:00:00+08:00")).toBe("open");
  });

  it("還沒發布時一律是未發布，即使講師已經關閉", () => {
    const base = getSession("s-ci-1022")!;
    const closed: Session = { ...base, portal: { ...base.portal, closedAt: "2026-10-01T00:00:00+08:00" } };
    expect(portalState(closed, MOCK_NOW)).toBe("unpublished");
  });

  it("找不到代碼回傳 undefined", () => {
    expect(portalView("nope", MOCK_NOW)).toBeUndefined();
  });
});

describe("需求條目的負責課程", () => {
  const project = getProject("p-a-2026")!;

  it("列出沒有指定負責課程的需求條目", () => {
    expect(unassignedRequirements(project, COURSES).map((r) => r.id)).toEqual(["r-a-security"]);
  });

  it("負責課程不存在或屬於別的專案，也算沒人負責", () => {
    const withBadRefs: Project = {
      ...project,
      requirements: [
        ...project.requirements,
        { id: "r-x-gone", text: "指向已刪除的課程", sourceDocumentId: "doc-a-needs", keywords: [], minutes: null, courseId: "c-deleted" },
        { id: "r-x-other", text: "指向別的專案的課程", sourceDocumentId: "doc-a-needs", keywords: [], minutes: null, courseId: "c-pa-finance" },
      ],
    };
    expect(unassignedRequirements(withBadRefs, COURSES).map((r) => r.id)).toEqual([
      "r-a-security",
      "r-x-gone",
      "r-x-other",
    ]);
  });

  it("每條都有人負責時回傳空陣列", () => {
    expect(unassignedRequirements(getProject("p-b-2026")!, COURSES)).toEqual([]);
  });
});

describe("專案列表依狀態分組", () => {
  it("洽談中、進行中、封存各自一組，封存不和進行中混在一起", () => {
    const groups = projectsByStatus(PROJECTS);
    expect(groups.map((g) => [g.status, g.projects.map((p) => p.id)])).toEqual([
      ["negotiating", ["p-c-2027"]],
      ["active", ["p-a-2026", "p-b-2026", "p-e-2026"]],
      ["archived", ["p-d-2026"]],
    ]);
  });

  it("沒有專案的狀態也保留空的一組，畫面上的順序固定", () => {
    const groups = projectsByStatus([getProject("p-d-2026")!]);
    expect(groups.map((g) => [g.status, g.projects.length])).toEqual([
      ["negotiating", 0],
      ["active", 0],
      ["archived", 1],
    ]);
  });
});

describe("專案 fixture 參照完整", () => {
  const docIds = (p: Project) => p.clientDocuments.map((d) => d.id);

  it("有指定負責課程的需求條目，課程存在且屬於同一個專案", () => {
    for (const p of PROJECTS) {
      for (const r of p.requirements) {
        if (r.courseId === null) continue;
        expect(getCourse(r.courseId)?.projectId).toBe(p.id);
      }
    }
  });

  it("需求條目的來源是同一個專案的客戶文件", () => {
    for (const p of PROJECTS) {
      for (const r of p.requirements) {
        if (r.sourceDocumentId !== null) expect(docIds(p)).toContain(r.sourceDocumentId);
      }
    }
  });

  it("只有回饋會指向課程大綱，且指向同一個專案裡存在的課程大綱", () => {
    for (const p of PROJECTS) {
      const outlineIds = coursesOfProject(p.id).flatMap((c) =>
        c.artifacts.filter((a) => a.kind === "outline").map((a) => a.id),
      );
      for (const d of p.clientDocuments) {
        if (d.respondsToOutlineId === null) continue;
        expect(d.kind).toBe("feedback");
        expect(outlineIds).toContain(d.respondsToOutlineId);
      }
    }
  });

  it("客戶文件 id 在所有專案間不重複", () => {
    const ids = PROJECTS.flatMap(docIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fixture 至少示範一則指向課程大綱的回饋", () => {
    expect(getProject("p-a-2026")!.clientDocuments.find((d) => d.kind === "feedback")?.respondsToOutlineId).toBe(
      "a-ci-outline-1",
    );
  });
});

describe("課程頁的需求對照", () => {
  it("「Claude 入門」逐條列出負責的需求條目，三種狀態都有", () => {
    const rows = requirementMappingOfCourse(getCourse("c-claude-intro")!);
    expect(rows.map((r) => [r.requirement.id, r.mapping.status, r.mapping.deltaMinutes])).toEqual([
      ["r-a-8d", "covered", 30],
      ["r-a-project", "partial", null],
      ["r-a-limits", "partial", -30],
      ["r-a-supplier", "partial", 0],
      ["r-a-weekly", "not_found", -30],
    ]);
  });

  it("附上設計稿標註的實質涵蓋判斷；沒標註的為 null", () => {
    const rows = requirementMappingOfCourse(getCourse("c-claude-advanced")!);
    expect(rows.map((r) => [r.requirement.id, r.review])).toEqual([["r-a-handover", null]]);
    const intro = requirementMappingOfCourse(getCourse("c-claude-intro")!);
    expect(intro.find((r) => r.requirement.id === "r-a-weekly")!.review?.substantive).toBe(false);
  });

  it("沒有負責任何需求條目的課程回傳空陣列", () => {
    expect(requirementMappingOfCourse(getCourse("c-gas-two-day")!)).toEqual([]);
  });

  it("實質涵蓋標註都指向存在的需求條目", () => {
    const ids = PROJECTS.flatMap((p) => p.requirements.map((r) => r.id));
    for (const r of REQUIREMENT_REVIEWS) expect(ids).toContain(r.requirementId);
  });
});
