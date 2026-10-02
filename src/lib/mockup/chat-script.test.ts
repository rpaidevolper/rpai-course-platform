import { describe, expect, it } from "vitest";
import { BlueprintSchema, checkBlueprint, plannedMinutes, type Blueprint } from "@/lib/blueprint/schema";
import { demoReducer, starterBlueprint } from "./actions";
import { openingMessage, reviseBlueprint, revisionNote, scriptedReply } from "./chat-script";
import { COURSES, FRAMEWORKS, PROJECTS, SCENARIOS } from "./data";
import { getCourse, getSession, readiness } from "./logic";
import { initialState } from "./state";

const bpOf = (id: string) => COURSES.find((c) => c.id === id)!.blueprint;
const intro = bpOf("c-claude-intro"); // 缺金句、1 個要改的單元
const advanced = bpOf("c-claude-advanced"); // 缺故事、1 個要改的單元、3 個待確認
const gas = bpOf("c-gas-two-day"); // 6 個要改／新做的單元、2 個待確認、1 個未確認工具
const pa = bpOf("c-pa-finance"); // 完整
const starter = starterBlueprint({
  title: "新課程",
  clientContext: PROJECTS[0].clientContext,
  framework: FRAMEWORKS[0],
  scenario: SCENARIOS[0],
});
const scratch = starterBlueprint({ title: "從零開始", clientContext: PROJECTS[0].clientContext });

/** pa 上午時段拉長到 200 分鐘：單元要放大 */
const stretched: Blueprint = structuredClone(pa);
stretched.days[0].slots[0].minutes = 200;
/** gas 第 2 天上午有個單元多排了 25 分鐘：單元要縮小 */
const overbooked: Blueprint = structuredClone(gas);
overbooked.days[1].slots[0].units[0].minutes += 25;

/** readiness 會列的藍圖問題；lecture_only 是設計提醒，不算 */
const blocking = (bp: Blueprint) => checkBlueprint(bp).filter((i) => i.kind !== "lecture_only");

describe("fixtures 前提", () => {
  it("各課程的缺項如測試所假設", () => {
    expect(blocking(intro).map((i) => i.kind)).toEqual(["missing_element", "unit_needs_work"]);
    expect(blocking(advanced).map((i) => i.kind)).toEqual([
      "missing_element",
      "unit_needs_work",
      "open_question",
      "open_question",
      "open_question",
    ]);
    expect(blocking(pa)).toEqual([]);
    expect(blocking(stretched).map((i) => i.kind)).toEqual(["duration_mismatch"]);
    expect(blocking(overbooked).filter((i) => i.kind === "duration_mismatch")).toHaveLength(1);
    expect(blocking(gas).filter((i) => i.kind === "unconfirmed_tool")).toHaveLength(1);
  });
});

describe("openingMessage", () => {
  it("列出缺的五元素、要準備的單元與待確認事項，並問第一題", () => {
    const text = openingMessage(advanced).text;
    expect(text).toContain("五元素還缺：故事");
    expect(text).toContain("單元還要準備：要改 1 個");
    expect(text).toContain("待確認事項 3 件");
    expect(text).toContain("先補「故事」");
  });

  it("待確認事項含未確認的工具", () => {
    const text = openingMessage(gas).text;
    expect(text).toContain("待確認事項 3 件");
    expect(text).toContain("Google Apps Script");
    expect(text).toContain("要改 1 個、新做 5 個");
  });

  it("提到時段時間不符", () => {
    expect(openingMessage(stretched).text).toContain("第 1 天上午（單元加總 180／時段 200 分鐘）");
  });

  it("藍圖完整時說明可以調整什麼", () => {
    expect(openingMessage(pa).text).toContain("很完整");
  });
});

describe("scriptedReply", () => {
  it("接著問下一個缺項，並引用講師的話", () => {
    const reply = scriptedReply(advanced, 0, "那個品保課長的案例可以用");
    expect(reply.role).toBe("assistant");
    expect(reply.text).toContain("那個品保課長的案例可以用");
    expect(reply.text).toContain("審核規則寫成提示詞");
    expect(scriptedReply(advanced, 1, "改成部門版").text).toContain("台中廠還是台北總部");
  });

  it("題目問完後提示按「更新藍圖」", () => {
    expect(scriptedReply(intro, 1, "好").text).toContain("更新藍圖");
    expect(scriptedReply(pa, 0, "好").text).toContain("更新藍圖");
  });
});

describe("reviseBlueprint", () => {
  const cases: [string, Blueprint][] = [
    ["缺金句", intro],
    ["缺故事與待確認", advanced],
    ["兩天、未確認工具", gas],
    ["完整", pa],
    ["時段拉長", stretched],
    ["單元超時", overbooked],
    ["框架起始草稿", starter],
    ["從零起始草稿", scratch],
  ];

  it.each(cases)("%s：通過 schema、只剩純講述提醒、不改動輸入、可重現", (_, bp) => {
    const before = structuredClone(bp);
    const messages = ["學員大約二十人", "  ", "一天沒做完的事，明天還會在"];
    const result = reviseBlueprint(bp, messages);
    expect(() => BlueprintSchema.parse(result)).not.toThrow();
    expect(blocking(result)).toEqual([]);
    expect(bp).toEqual(before);
    expect(reviseBlueprint(bp, messages)).toEqual(result);
    expect(revisionNote(bp, result).length).toBeGreaterThan(0);
  });

  it("沒有講師訊息（或只有空白）也能產出合法藍圖", () => {
    expect(blocking(reviseBlueprint(scratch, ["   "]))).toEqual([]);
    expect(blocking(reviseBlueprint(gas, []))).toEqual([]);
  });

  it("第 i 句話回答第 i 題：故事 → 要改的單元 → 三個待確認事項", () => {
    const result = reviseBlueprint(advanced, ["品保課長的 8D 故事", "改用部門版範例", "台中廠", "業務部不來", "用品保的"]);
    expect(result.elements.story).toEqual(["品保課長的 8D 故事"]);
    const unit = result.days[0].slots[0].units.find((u) => u.title === "審核規則寫成提示詞")!;
    expect(unit.keyPoints).toContain("改用部門版範例");
    expect(unit.reuse).toBe("reuse");
    expect(result.openQuestions).toEqual([]);
    expect(result.constraints).toContain("已確認「場地要在台中廠還是台北總部？」：台中廠");
    expect(result.constraints).toContain("已確認「要不要讓業務部一起來？」：業務部不來");
    expect(result.constraints).toContain("已確認「審核規則的範例用品保還是生管的案例」：用品保的");
  });

  it("講師的回答只填進被問到的那一格，不會被拿去當金句", () => {
    const result = reviseBlueprint(intro, ["主管不用會寫，要會挑錯"]);
    expect(result.elements.quote).toEqual(["主管不用會寫，要會挑錯"]);
    expect(result.days[0].slots[1].units.at(-1)!.elements).toContain("quote");
    expect(result.days[0].slots[0].units[1].keyPoints).not.toContain("主管不用會寫，要會挑錯");
  });

  it("未確認的工具標成已確認並記下", () => {
    const result = reviseBlueprint(gas, []);
    expect(result.tools.every((t) => t.confirmedWithClient)).toBe(true);
    expect(result.constraints).toContain("已跟客戶確認學員可用 Google Apps Script（企業版）");
  });

  it("時段時間不符時，單元分鐘數照比例調到剛好等於時段長度", () => {
    const up = reviseBlueprint(stretched, []).days[0].slots[0];
    expect(plannedMinutes(up)).toBe(200);
    expect(up.units.map((u) => u.minutes)).toEqual([66, 134]);
    const down = reviseBlueprint(overbooked, []).days[1].slots[0];
    expect(plannedMinutes(down)).toBe(180);
    expect(down.units.every((u) => u.minutes > 0)).toBe(true);
  });

  it("起始草稿的佔位文字被換掉", () => {
    const result = reviseBlueprint(starter, []);
    const units = result.days.flatMap((d) => d.slots.flatMap((s) => s.units));
    expect(units.every((u) => u.outcome !== "待跟 AI 談" && !u.keyPoints.includes("待跟 AI 談"))).toBe(true);
    expect(result.audience.priorKnowledge).not.toBe("待確認");
  });

  it("單元標題不變（承接與待確認事項靠標題參照）", () => {
    const titles = (bp: Blueprint) => bp.days.flatMap((d) => d.slots.flatMap((s) => s.units.map((u) => u.title)));
    expect(titles(reviseBlueprint(gas, ["a", "b"]))).toEqual(titles(gas));
  });

  it("再改一次不會重複加入同樣的內容", () => {
    const once = reviseBlueprint(gas, ["想多一點練習"]);
    const twice = reviseBlueprint(once, ["想多一點練習"]);
    expect(new Set(twice.constraints).size).toBe(twice.constraints.length);
  });

  it("更新後場次準備度不再列藍圖相關的項目", () => {
    const st0 = initialState();
    const course = getCourse(st0, "c-gas-two-day")!;
    const blueprint = reviseBlueprint(course.blueprint, ["好"]);
    const st = demoReducer(st0, { type: "blueprint/revise", courseId: course.id, blueprint, note: revisionNote(course.blueprint, blueprint) });
    const kinds = readiness(st, getSession(st, "s-gas-1020")!).map((i) => i.kind);
    for (const k of ["open_items", "missing_elements", "duration_mismatch", "units_need_work"]) {
      expect(kinds).not.toContain(k);
    }
    expect(readiness(st0, getSession(st0, "s-gas-1020")!).map((i) => i.kind)).toContain("units_need_work");
  });
});

describe("revisionNote", () => {
  it("摘要補了哪些五元素、改好幾個單元、確認幾件事", () => {
    expect(revisionNote(advanced, reviseBlueprint(advanced, ["好"]))).toBe("補上故事、確認 3 件待確認事項、改好 1 個要改／新做的單元");
  });

  it("多個五元素用「、」與「與」串起來", () => {
    expect(revisionNote(scratch, reviseBlueprint(scratch, []))).toMatch(/^補上理論、動手、帶走、金句與故事/);
  });

  it("時段對齊", () => {
    expect(revisionNote(stretched, reviseBlueprint(stretched, []))).toBe("1 個時段的單元時間對齊時段長度");
  });

  it("完整藍圖只記講師補充", () => {
    expect(revisionNote(pa, reviseBlueprint(pa, ["想多一點練習"]))).toBe("記下講師補充");
  });
});
