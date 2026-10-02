import { describe, expect, it } from "vitest";
import { BlueprintSchema, checkBlueprint } from "@/lib/blueprint/schema";
import {
  COURSES,
  FRAMEWORKS,
  KNOWLEDGE_DRAFTS,
  MOCK_NOW,
  PROJECTS,
  SESSIONS,
} from "./data";
import {
  coursesOfProject,
  getCourse,
  getProject,
  getSession,
  isStale,
  latestArtifact,
  portalState,
  portalView,
  projectsByStatus,
  readiness,
  unassignedRequirements,
  upcomingSessions,
} from "./logic";
import type { Project, Session } from "./types";

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

  it("產物指向存在的藍圖版本", () => {
    for (const c of COURSES) {
      const versions = c.blueprintHistory.map((v) => v.version);
      for (const a of c.artifacts) expect(versions).toContain(a.blueprintVersion);
    }
  });

  it("發布只鎖定同一門課程的產物與素材", () => {
    for (const s of SESSIONS) {
      if (!s.publication) continue;
      const c = getCourse(s.courseId)!;
      for (const id of s.publication.artifactIds) expect(c.artifacts.map((a) => a.id)).toContain(id);
      for (const id of s.publication.materialIds) expect(c.materials.map((m) => m.id)).toContain(id);
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

describe("產物過期", () => {
  const course = getCourse("c-claude-intro")!;

  it("出自舊版藍圖的產物算過期，出自最新版的不算", () => {
    expect(isStale(course, latestArtifact(course, "handbook")!)).toBe(true);
    expect(isStale(course, latestArtifact(course, "slides")!)).toBe(false);
  });
});

describe("準備度", () => {
  const kinds = (id: string) => readiness(getSession(id)!).map((i) => i.kind);

  it("已發布但有較新產物時，提示還沒發布新版", () => {
    const items = readiness(getSession("s-ci-1015")!);
    expect(items).toContainEqual({ kind: "publication_outdated", artifacts: ["outline", "slides"] });
    expect(items).toContainEqual({ kind: "artifact_stale", artifact: "handbook", version: 1 });
    expect(kinds("s-ci-1015")).not.toContain("unpublished");
  });

  it("未發布、沒填連結的場次兩項都列出", () => {
    expect(kinds("s-ci-1022")).toEqual(expect.arrayContaining(["unpublished", "no_links"]));
  });

  it("藍圖有待確認問題、缺五元素、沒產物、地點未定都列出", () => {
    const items = readiness(getSession("s-ca-1105")!);
    expect(items).toContainEqual({ kind: "open_questions", count: 2 });
    expect(items).toContainEqual({ kind: "missing_elements", labels: ["故事"] });
    expect(items.filter((i) => i.kind === "artifact_missing")).toHaveLength(3);
    expect(items.map((i) => i.kind)).toContain("venue_unset");
  });

  it("全部就緒的場次沒有缺項", () => {
    expect(readiness(getSession("s-pa-0918")!)).toEqual([]);
  });
});

describe("講師首頁的場次", () => {
  it("只列還沒結束的場次，依開始時間排序", () => {
    expect(upcomingSessions(MOCK_NOW).map((s) => s.id)).toEqual(["s-ci-1015", "s-ci-1022", "s-ca-1105"]);
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
      ["artifacts", "courseTitle", "endsAt", "expiresAt", "links", "materials", "startsAt", "state", "venue"],
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
        { id: "r-x-gone", text: "指向已刪除的課程", sourceDocumentId: "doc-a-needs", minutes: null, courseId: "c-deleted" },
        { id: "r-x-other", text: "指向別的專案的課程", sourceDocumentId: "doc-a-needs", minutes: null, courseId: "c-pa-finance" },
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
