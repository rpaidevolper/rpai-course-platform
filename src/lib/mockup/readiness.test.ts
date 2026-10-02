import { describe, expect, it } from "vitest";
import { MOCK_NOW } from "./data";
import {
  getCourse,
  getSession,
  readiness,
  readinessGroups,
  readinessText,
  upcomingSessions,
  type ReadinessItem,
} from "./logic";
import type { Course, Session } from "./types";
import { initialState } from "./state";

const st = initialState();

/** 準備度彙整（#25 user story 48）：每一種來源各有正例與反例，只透過 readiness／readinessText／readinessGroups 驗證。 */

const session = (id: string) => getSession(st, id)!;
const course = (id: string) => getCourse(st, id)!;
const items = (s: Session, c?: Course) => readiness(st, s, c);
const ofKind = <K extends ReadinessItem["kind"]>(list: ReadinessItem[], kind: K) =>
  list.filter((i): i is Extract<ReadinessItem, { kind: K }> => i.kind === kind);
const texts = (list: ReadinessItem[]) => list.map(readinessText);

describe("準備度：全部就緒", () => {
  it.each(["s-pa-0918", "s-pa-1029"])("場次 %s 沒有任何缺項", (id) => {
    expect(items(session(id))).toEqual([]);
    expect(readinessGroups(items(session(id)))).toEqual([]);
  });

  it("首頁接下來的場次裡至少有一場已經準備好", () => {
    expect(upcomingSessions(st, MOCK_NOW).some((s) => readiness(st, s).length === 0)).toBe(true);
  });
});

describe("準備度：待確認事項", () => {
  it("待確認事項含未確認的工具，並標出有幾個是工具", () => {
    // 兩件 openQuestions、一個未確認工具
    const [item] = ofKind(items(session("s-gas-1020")), "open_items");
    expect(item).toEqual({ kind: "open_items", count: 3, tools: 1 });
    expect(readinessText(item)).toBe("藍圖還有 3 個待確認事項（含 1 個未確認的工具）");
  });

  it("沒有未確認工具時不提工具", () => {
    const [item] = ofKind(items(session("s-ca-1105")), "open_items");
    expect(item).toEqual({ kind: "open_items", count: 3, tools: 0 });
    expect(readinessText(item)).toBe("藍圖還有 3 個待確認事項");
  });

  it("只有未確認的工具也算待確認事項", () => {
    const base = course("c-pa-finance");
    const bp = { ...base.blueprint, tools: base.blueprint.tools.map((t, i) => (i === 0 ? { ...t, confirmedWithClient: false } : t)) };
    expect(ofKind(items(session("s-pa-1029"), { ...base, blueprint: bp }), "open_items")).toEqual([
      { kind: "open_items", count: 1, tools: 1 },
    ]);
  });

  it("沒有待確認事項時不列", () => {
    expect(ofKind(items(session("s-ci-1022")), "open_items")).toEqual([]);
  });
});

describe("準備度：缺五元素", () => {
  it("列出缺的元素", () => {
    expect(ofKind(items(session("s-ca-1105")), "missing_elements")).toEqual([{ kind: "missing_elements", labels: ["故事"] }]);
  });

  it("五元素齊全時不列", () => {
    expect(ofKind(items(session("s-gas-1020")), "missing_elements")).toEqual([]);
  });
});

describe("準備度：時段時間對不上", () => {
  it("單元分鐘數加總不等於時段長度時，列出是哪一天哪個時段", () => {
    const base = course("c-pa-finance");
    const [day1] = base.blueprint.days;
    const [morning] = day1.slots;
    const shortened = { ...morning, units: morning.units.map((u, i) => (i === 0 ? { ...u, minutes: u.minutes - 10 } : u)) };
    const bp = { ...base.blueprint, days: [{ ...day1, slots: [shortened, ...day1.slots.slice(1)] }, ...base.blueprint.days.slice(1)] };
    const list = ofKind(items(session("s-pa-1029"), { ...base, blueprint: bp }), "duration_mismatch");
    expect(list).toEqual([
      { kind: "duration_mismatch", slots: [{ day: 1, slotLabel: morning.label, planned: morning.minutes - 10, expected: morning.minutes }] },
    ]);
    expect(readinessText(list[0])).toBe(`第 1 天${morning.label}單元排了 ${morning.minutes - 10} 分鐘，時段是 ${morning.minutes} 分鐘`);
  });

  it("每個時段都對得上時不列", () => {
    expect(ofKind(items(session("s-gas-1020")), "duration_mismatch")).toEqual([]);
  });
});

describe("準備度：要改或新做的單元", () => {
  it("列出要改與新做各幾個", () => {
    const [item] = ofKind(items(session("s-gas-1020")), "units_need_work");
    expect(item).toEqual({ kind: "units_need_work", modify: 1, new: 5 });
    expect(readinessText(item)).toBe("還有 1 個單元要改、5 個單元要新做");
  });

  it("只有要改的單元時不提新做", () => {
    const [item] = ofKind(items(session("s-ca-1105")), "units_need_work");
    expect(readinessText(item)).toBe("還有 1 個單元要改");
  });

  it("每個單元都沿用時不列", () => {
    expect(ofKind(items(session("s-pa-1029")), "units_need_work")).toEqual([]);
  });
});

describe("準備度：需求對照缺口", () => {
  it("⚠️ 與 ❌ 的需求條目都列出，依需求對照的順序", () => {
    const [item] = ofKind(items(session("s-ci-1022")), "requirement_gaps");
    expect(item).toEqual({
      kind: "requirement_gaps",
      notFound: ["週會記錄整理成跨部門待辦"],
      partial: [
        "學員課後要有一個能直接用的部門 Project",
        "先講清楚 AI 能做與不能做的事，至少一個半小時",
        "供應商來信的交期比對要有一段實作",
      ],
    });
    expect(readinessText(item)).toBe("需求對照有 1 條在藍圖裡找不到、3 條只部分涵蓋");
  });

  it("只有找不到的條目時不提部分涵蓋", () => {
    const [item] = ofKind(items(session("s-ca-1105")), "requirement_gaps");
    expect(item).toEqual({ kind: "requirement_gaps", notFound: ["主管要學會把個人用法寫成部門可交接的流程"], partial: [] });
    expect(readinessText(item)).toBe("需求對照有 1 條在藍圖裡找不到");
  });

  it("負責的需求全部 ✅ 時不列", () => {
    expect(ofKind(items(session("s-pa-1029")), "requirement_gaps")).toEqual([]);
  });

  it("課程沒有負責任何需求時不列", () => {
    expect(ofKind(items(session("s-gas-1020")), "requirement_gaps")).toEqual([]);
  });
});

describe("準備度：逐頁腳本沒有可用版本或還沒定稿", () => {
  it("某天最新可用的逐頁腳本還沒定稿時列出是哪一天哪一版", () => {
    const list = ofKind(items(session("s-gas-1020")), "script_not_finalized");
    expect(list).toEqual([{ kind: "script_not_finalized", day: 1, version: 2 }]);
    expect(readinessText(list[0])).toBe("第 1 天逐頁腳本 v2 還沒定稿");
  });

  it("逐頁腳本只有還在產的版本時，算沒有可用的版本", () => {
    const base = course("c-pa-finance");
    const generating = {
      ...base,
      artifacts: base.artifacts.map((a) => (a.kind === "page_script" ? { ...a, status: "generating" as const, finalizedAt: null } : a)),
    };
    const list = items(session("s-pa-1029"), generating);
    expect(ofKind(list, "artifact_missing")).toEqual([{ kind: "artifact_missing", artifact: "page_script", day: 1 }]);
    expect(ofKind(list, "script_not_finalized")).toEqual([]);
    expect(texts(ofKind(list, "artifact_missing"))).toEqual(["還沒有可用的第 1 天逐頁腳本"]);
  });

  it("每一天最新可用的逐頁腳本都已定稿時不列", () => {
    expect(ofKind(items(session("s-ci-1022")), "script_not_finalized")).toEqual([]);
  });
});

describe("準備度：還沒產出的產物", () => {
  it("整條產物鏈都還沒產時每一份都列出", () => {
    expect(ofKind(items(session("s-ca-1105")), "artifact_missing")).toEqual([
      { kind: "artifact_missing", artifact: "outline", day: null },
      { kind: "artifact_missing", artifact: "prep_sheet", day: null },
      { kind: "artifact_missing", artifact: "page_script", day: 1 },
      { kind: "artifact_missing", artifact: "slides", day: 1 },
      { kind: "artifact_missing", artifact: "handbook", day: null },
    ]);
  });

  it("每一份都有可用版本時不列", () => {
    expect(ofKind(items(session("s-gas-1020")), "artifact_missing")).toEqual([]);
  });
});

describe("準備度：沿鏈過期的產物", () => {
  it("只改第一天逐頁腳本：第一天簡報與學員手冊過期，並說明原因", () => {
    const list = ofKind(items(session("s-gas-1020")), "artifact_stale");
    expect(list.map((i) => [i.artifact, i.day])).toEqual([
      ["slides", 1],
      ["handbook", null],
    ]);
    expect(texts(list)).toEqual([
      "第 1 天簡報 v1 已過期：第 1 天逐頁腳本已到 v2",
      "學員手冊 v1 已過期：第 1 天逐頁腳本已到 v2",
    ]);
  });

  it("藍圖與上游都改過時兩個原因都列出", () => {
    const [item] = ofKind(items(session("s-ci-1015")), "artifact_stale");
    expect(item).toEqual({
      kind: "artifact_stale",
      artifact: "handbook",
      day: null,
      version: 1,
      reasons: [
        { kind: "blueprint", latestVersion: 3 },
        { kind: "upstream", artifact: "page_script", day: 1, latestVersion: 2 },
      ],
    });
    expect(readinessText(item)).toBe("學員手冊 v1 已過期：藍圖已到 v3、第 1 天逐頁腳本已到 v2");
  });

  it("沒有過期的產物時不列", () => {
    expect(ofKind(items(session("s-pa-1029")), "artifact_stale")).toEqual([]);
  });
});

describe("準備度：場次天數與藍圖不符", () => {
  it("場次少排一天時列出兩邊的天數", () => {
    const base = session("s-gas-1020");
    const list = ofKind(items({ ...base, days: [base.days[0]] }), "day_count_mismatch");
    expect(list).toEqual([{ kind: "day_count_mismatch", sessionDays: 1, blueprintDays: 2 }]);
    expect(readinessText(list[0])).toBe("場次排了 1 天，藍圖是 2 天");
  });

  it("天數相符時不列", () => {
    expect(ofKind(items(session("s-gas-1020")), "day_count_mismatch")).toEqual([]);
  });
});

describe("準備度：素材、連結與發布", () => {
  it("課程沒有素材時列出", () => {
    expect(texts(ofKind(items(session("s-gas-1020")), "no_materials"))).toEqual(["還沒上傳素材"]);
  });

  it("有素材時不列", () => {
    expect(ofKind(items(session("s-ci-1022")), "no_materials")).toEqual([]);
  });

  it("未發布、沒填連結的場次兩項都列出", () => {
    expect(items(session("s-ci-1022")).map((i) => i.kind)).toEqual(expect.arrayContaining(["unpublished", "no_links"]));
  });

  it("已發布、有連結的場次兩項都不列", () => {
    const kinds = items(session("s-ci-1015")).map((i) => i.kind);
    expect(kinds).not.toContain("unpublished");
    expect(kinds).not.toContain("no_links");
  });

  it("已發布但有較新的可用產物時，提示還沒發布新版", () => {
    expect(ofKind(items(session("s-ci-1015")), "publication_outdated")).toEqual([
      {
        kind: "publication_outdated",
        artifacts: [
          { kind: "outline", day: null },
          { kind: "slides", day: 1 },
        ],
      },
    ]);
  });

  it("發布的已是最新版時不提示", () => {
    expect(ofKind(items(session("s-pa-1029")), "publication_outdated")).toEqual([]);
  });
});

describe("準備度依來源分組", () => {
  it("依固定順序分組，沒有缺項的來源不出現", () => {
    const groups = readinessGroups(items(session("s-ca-1105")));
    expect(groups.map((g) => g.label)).toEqual(["藍圖", "需求對照", "產物", "場次安排", "給學員的東西"]);
    expect(groups.find((g) => g.source === "requirements")!.items.map((i) => i.kind)).toEqual(["requirement_gaps"]);
  });

  it("每一個缺項都恰好落在一組", () => {
    const list = items(session("s-gas-1020"));
    const groups = readinessGroups(list);
    expect(groups.flatMap((g) => g.items)).toHaveLength(list.length);
    expect(groups.map((g) => g.source)).toEqual(["blueprint", "artifacts", "publication"]);
  });
});
