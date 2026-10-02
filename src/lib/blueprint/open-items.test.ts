import { describe, expect, it } from "vitest";
import { clientEmailText, openItems } from "./open-items";
import { BlueprintSchema, type Blueprint, type OpenQuestion, type Tool } from "./schema";

const unit = (title: string, minutes: number) => ({
  title,
  minutes,
  objective: `完成「${title}」`,
  method: "示範後實作",
  outcome: `「${title}」成品`,
  keyPoints: ["重點"],
  activity: "動手做一次",
  elements: ["handsOn" as const],
  carriesFrom: null,
});

/** 兩天的小藍圖，只有待確認事項與工具由測試決定。 */
function blueprint(openQuestions: OpenQuestion[], tools: Tool[] = []): Blueprint {
  return BlueprintSchema.parse({
    title: "週報自動化",
    oneLiner: "用 AI 寫週報",
    audience: { who: "行政人員", size: null, priorKnowledge: "會用 Excel", painPoints: ["週報很花時間"] },
    outcomes: ["十分鐘寫完週報"],
    format: { mode: "workshop", venue: null },
    narrative: { model: "SCQA", arc: ["現況", "方案"] },
    elements: { theory: ["a"], handsOn: ["b"], takeaway: ["c"], quote: ["d"], story: ["e"] },
    days: [
      {
        theme: "個人週報",
        slots: [
          { label: "上午", minutes: 180, units: [unit("週報拆解", 180)] },
          { label: "下午", minutes: 180, units: [unit("第一份草稿", 180)] },
        ],
      },
      {
        theme: "部門週報",
        slots: [{ label: "上午", minutes: 180, units: [unit("部門版範本", 180)] }],
      },
    ],
    constraints: [],
    tools,
    openQuestions,
  });
}

describe("openItems", () => {
  it("沒有待確認事項、工具都已確認時是空的", () => {
    expect(openItems(blueprint([], [{ name: "Claude", plan: "paid", confirmedWithClient: true }]))).toEqual([]);
  });

  it("未確認的工具變成問客戶的事項，不掛在單元上", () => {
    const items = openItems(blueprint([], [{ name: "Copilot", plan: "enterprise", confirmedWithClient: false }]));
    expect(items).toEqual([
      { text: "學員是否都能使用 Copilot（企業版）？", audience: "client", unit: null, tool: "Copilot" },
    ]);
  });

  it("待確認事項保留對象與受影響單元", () => {
    const items = openItems(
      blueprint([
        { text: "場地有沒有 Wi-Fi？", audience: "client", unit: "第一份草稿" },
        { text: "要不要附評分表", audience: "self", unit: null },
      ]),
    );
    expect(items).toEqual([
      { text: "場地有沒有 Wi-Fi？", audience: "client", unit: "第一份草稿", tool: null },
      { text: "要不要附評分表", audience: "self", unit: null, tool: null },
    ]);
  });
});

describe("clientEmailText", () => {
  it("沒有問客戶的事項時回傳 null", () => {
    expect(clientEmailText(blueprint([{ text: "要不要附評分表", audience: "self", unit: null }]))).toBeNull();
  });

  it("把問客戶的事項與未確認工具排成可貼進信件的編號清單，自己決定的事不放進去", () => {
    const bp = blueprint(
      [
        { text: "要不要附評分表", audience: "self", unit: null },
        { text: "場地有沒有 Wi-Fi？", audience: "client", unit: null },
        { text: "能不能用真實週報當範例？", audience: "client", unit: "部門版範本" },
      ],
      [
        { name: "Claude", plan: "paid", confirmedWithClient: true },
        { name: "Copilot", plan: "enterprise", confirmedWithClient: false },
      ],
    );
    expect(clientEmailText(bp)).toBe(
      [
        "關於「週報自動化」，有幾件事想跟您確認：",
        "",
        "1. 場地有沒有 Wi-Fi？",
        "2. 能不能用真實週報當範例？（影響第 2 天上午「部門版範本」）",
        "3. 學員是否都能使用 Copilot（企業版）？",
      ].join("\n"),
    );
  });

  it("受影響單元在藍圖裡找不到時，只寫出單元名稱", () => {
    const bp = blueprint([{ text: "要不要錄影？", audience: "client", unit: "已刪掉的單元" }]);
    expect(clientEmailText(bp)).toBe(
      ["關於「週報自動化」，有幾件事想跟您確認：", "", "1. 要不要錄影？（影響「已刪掉的單元」）"].join("\n"),
    );
  });
});
