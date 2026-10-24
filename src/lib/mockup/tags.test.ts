import { describe, expect, it } from "vitest";
import { COURSE_RECIPES, COURSES, INDUSTRY_PACKS, UNIT_CARDS } from "./data";
import { totalMinutes } from "@/lib/blueprint/schema";
import { demoReducer } from "./actions";
import { initialState, type DemoState } from "./state";
import { courseSpec, courseTags, courseTools, defaultCourseTags, recipeSpec, specOfHours, specOfMinutes, toggleTag, unitTags } from "./tags";
import { AUDIENCES, INDUSTRIES, SCENARIOS, TOOL_TAGS, type CourseTagSet } from "./types";

describe("specOfHours 規格由總時數推得", () => {
  // 每一檔的邊界：[時數, 規格]
  const cases: [number, string | null][] = [
    [0, null],
    [-1, null],
    [0.5, "短講座"],
    [2, "短講座"], // ≤2H 含 2
    [2.5, "短講座"], // 2 與 3 之間：沿用前一檔
    [2.99, "短講座"],
    [3, "半日"],
    [4, "半日"],
    [5, "半日"], // 4 與 6 之間：沿用前一檔
    [5.99, "半日"],
    [6, "一日"],
    [8, "一日"], // 6 與 12 之間：仍是一日
    [11.99, "一日"],
    [12, "兩日"], // 6H×2
    [15, "兩日"], // 12 與 18 之間
    [17.99, "兩日"],
    [18, "系列班"], // 6H×3
    [24, "系列班"], // 6H×4
    [25, "系列班"], // 24 與 30 之間
    [29.99, "系列班"],
    [30, "長期班"], // 30H 以上
    [100, "長期班"],
  ];
  it.each(cases)("%sH → %s", (hours, spec) => {
    expect(specOfHours(hours)).toBe(spec);
  });

  it("以分鐘計：179 分鐘還不到 3H，180 分鐘才是半日", () => {
    expect(specOfMinutes(179)).toBe("短講座");
    expect(specOfMinutes(180)).toBe("半日");
    expect(specOfMinutes(0)).toBeNull();
  });

  it("比 18H 只差浮點誤差的時數，仍算系列班（先四捨五入到分鐘）", () => {
    const almost18 = 18 - 1e-12;
    // 前提：這個時數換成分鐘後，在浮點數上真的比 1080 小一點點
    expect(almost18 * 60).toBeLessThan(18 * 60);
    expect(specOfHours(almost18)).toBe("系列班");
  });
});

describe("toggleTag 多選", () => {
  it("可以一個一個加，也可以取消", () => {
    let t: string[] = [];
    t = toggleTag(t, "財務");
    t = toggleTag(t, "品保");
    expect(t).toEqual(["財務", "品保"]);
    t = toggleTag(t, "財務");
    expect(t).toEqual(["品保"]);
  });

  it("不改動原本的陣列", () => {
    const before = ["財務"];
    toggleTag(before, "品保");
    expect(before).toEqual(["財務"]);
  });
});

describe("開課程時挑標籤", () => {
  const create = (tags?: CourseTagSet) =>
    demoReducer(initialState(), {
      type: "course/create",
      id: "c-t",
      projectId: "p-a-2026",
      title: "t",
      moduleIds: [],
      totalHours: 6,
      industryPackId: "ip-manufacturing",
      tags,
    }).courses.find((c) => c.id === "c-t")!;

  it("對象、產業、應用場景三組都可以多選，存在課程上", () => {
    const c = create({
      audiences: ["生管資材", "品保"],
      industries: ["製造", "金融"],
      scenarios: ["文書", "數據分析", "簡報"],
    });
    expect(c.audiences).toEqual(["生管資材", "品保"]);
    expect(c.industries).toEqual(["製造", "金融"]);
    expect(c.scenarios).toEqual(["文書", "數據分析", "簡報"]);
  });

  it("沒有明確挑時，預設帶入所選產業素材包的標籤", () => {
    const c = create();
    const pack = INDUSTRY_PACKS.find((p) => p.id === "ip-manufacturing")!;
    expect(c.audiences).toEqual(pack.audiences);
    expect(c.industries).toEqual(pack.industries);
    expect(c.scenarios).toEqual(pack.scenarios);
  });

  it("沒有素材包也沒有挑：標籤是空的", () => {
    expect(defaultCourseTags(undefined)).toEqual({ audiences: [], industries: [], scenarios: [] });
  });

  it("重複的標籤只留一個", () => {
    const c = create({ audiences: ["財務", "財務"], industries: [], scenarios: [] });
    expect(c.audiences).toEqual(["財務"]);
  });
});

describe("課程的工具標籤：由藍圖推得，課程不另存", () => {
  const course = (id: string) => initialState().courses.find((c) => c.id === id)!;

  it("課程上沒有 tools 欄位：示範資料與新開的課程都一樣", () => {
    for (const c of initialState().courses) expect(c).not.toHaveProperty("tools");
    const created = demoReducer(initialState(), {
      type: "course/create", id: "c-t2", projectId: "p-a-2026", title: "t", moduleIds: [], totalHours: 6, industryPackId: "ip-manufacturing",
    }).courses.find((c) => c.id === "c-t2")!;
    expect(created).not.toHaveProperty("tools");
    expect(courseTools(created)).toEqual([]); // 新藍圖還沒談出工具
  });

  it("工具取藍圖 tools 的名稱（原樣、依藍圖順序、去重）", () => {
    expect(courseTools(course("c-pa-finance"))).toEqual(["Power Automate", "Microsoft Teams"]);
    expect(courseTools(course("c-claude-intro"))).toEqual(["Claude"]);
    const c = course("c-claude-intro");
    const dup = { ...c, blueprint: { ...c.blueprint, tools: [...c.blueprint.tools, { name: "Claude", plan: "free" as const, confirmedWithClient: false }, { name: "Excel", plan: "paid" as const, confirmedWithClient: true }] } };
    expect(courseTools(dup)).toEqual(["Claude", "Excel"]);
  });

  it("藍圖改了工具，課程的工具跟著變（顯示用的 courseTags 也是）", () => {
    const st = demoReducer(initialState(), {
      type: "blueprint/revise", courseId: "c-claude-intro", note: "改用 NotebookLM",
      blueprint: { ...course("c-claude-intro").blueprint, tools: [{ name: "NotebookLM", plan: "free", confirmedWithClient: false }] },
    });
    const c = st.courses.find((x) => x.id === "c-claude-intro")!;
    expect(courseTools(c)).toEqual(["NotebookLM"]);
    expect(courseTags(c).tools).toEqual(["NotebookLM"]);
    expect(courseTags(c).audiences).toEqual(c.audiences);
  });
});

describe("課程頁編輯標籤", () => {
  const update = (st: DemoState, courseId: string, tags: CourseTagSet) => demoReducer(st, { type: "course/updateTags", courseId, tags });
  const find = (st: DemoState, id: string) => st.courses.find((c) => c.id === id)!;

  it("對象、產業、應用場景可以改，重複的只留一個；其他欄位與別的課程不動", () => {
    const st0 = initialState();
    const st = update(st0, "c-claude-intro", { audiences: ["財務", "財務"], industries: ["金融"], scenarios: ["簡報"] });
    const c = find(st, "c-claude-intro");
    expect(c).toMatchObject({ audiences: ["財務"], industries: ["金融"], scenarios: ["簡報"] });
    expect(c.blueprint).toEqual(find(st0, "c-claude-intro").blueprint);
    expect(c).not.toHaveProperty("tools");
    expect(find(st, "c-pa-finance")).toEqual(find(st0, "c-pa-finance"));
  });

  it("可以清空某一組；不存在的課程不動", () => {
    expect(find(update(initialState(), "c-claude-intro", { audiences: [], industries: [], scenarios: [] }), "c-claude-intro").audiences).toEqual([]);
    const st0 = initialState();
    expect(update(st0, "c-nope", { audiences: [], industries: [], scenarios: [] }).courses).toEqual(st0.courses);
  });

  it("結案後不能再改（結案草稿已經依當時的標籤產生）", () => {
    const closed = demoReducer(initialState(), { type: "course/close", courseId: "c-pa-pilot" });
    expect(find(closed, "c-pa-pilot").closedAt).not.toBeNull();
    const st = update(closed, "c-pa-pilot", { audiences: ["品保"], industries: [], scenarios: [] });
    expect(find(st, "c-pa-pilot").audiences).toEqual(find(closed, "c-pa-pilot").audiences);
  });
});

describe("規格顯示：配方與課程各自推得，不另存", () => {
  it("配方的規格由單元卡分鐘數加總推得", () => {
    const st = initialState();
    const r = st.recipes.find((x) => x.id === "rc-m-governance")!; // 60+60+50 = 170 分鐘
    expect(recipeSpec(st, r)).toBe("短講座");
    const two = st.recipes.find((x) => x.id === "rc-l-rpa-2604")!; // 90+90+120+60 = 360 分鐘
    expect(recipeSpec(st, two)).toBe("一日");
  });

  it("課程的規格由藍圖總分鐘數推得，藍圖改長規格跟著變", () => {
    const c = COURSES[0];
    expect(courseSpec(c)).toBe(specOfMinutes(totalMinutes(c.blueprint)));
    const longer = structuredClone(c);
    longer.blueprint.days[0].slots[0].minutes += 3000;
    expect(courseSpec(longer)).toBe("長期班");
  });
});

describe("單元卡的標籤", () => {
  it("產業由用過它的配方推得，其餘三組存在單元卡上", () => {
    const st = initialState();
    const u = st.unitCards.find((x) => x.id === "uc-a1-limits")!;
    const t = unitTags(st, u);
    expect(t.industries).toEqual(["服務零售", "金融"]); // rc-f 與 rc-m
    expect(t.audiences).toEqual(u.audiences);
    expect(t.tools).toEqual(u.tools);
    expect(t.scenarios).toEqual(u.scenarios);
  });

  it("沒有配方用過的單元卡，產業是空的", () => {
    const st = initialState();
    const unused = st.unitCards.find((u) => !st.recipes.some((r) => r.unitIds.includes(u.id)));
    if (unused) expect(unitTags(st, unused).industries).toEqual([]);
  });
});

describe("fixture 的標籤都在清單內", () => {
  it("對象、工具、產業、應用場景", () => {
    for (const x of [...COURSE_RECIPES, ...INDUSTRY_PACKS, ...COURSES]) {
      for (const a of x.audiences) expect(AUDIENCES, x.id).toContain(a);
      if ("tools" in x) for (const t of x.tools) expect(TOOL_TAGS, x.id).toContain(t);
      for (const i of x.industries) expect(INDUSTRIES, x.id).toContain(i);
      for (const s of x.scenarios) expect(SCENARIOS, x.id).toContain(s);
    }
    for (const u of UNIT_CARDS) {
      for (const a of u.audiences) expect(AUDIENCES, u.id).toContain(a);
      for (const t of u.tools) expect(TOOL_TAGS, u.id).toContain(t);
      for (const s of u.scenarios) expect(SCENARIOS, u.id).toContain(s);
    }
  });
});
