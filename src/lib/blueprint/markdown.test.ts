import { describe, expect, it } from "vitest";
import { blueprintToMarkdown } from "./markdown";
import { sampleBlueprint } from "./testing";

/** 取出以「## 標題」開頭的段落內文（到下一個二級標題為止）。 */
function section(md: string, heading: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  if (start === -1) throw new Error(`找不到段落：${heading}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

describe("blueprintToMarkdown", () => {
  it("開頭是標題與一句話，受眾與形式照實寫，人數與場地沒填就寫未定", () => {
    const md = blueprintToMarkdown(sampleBlueprint({ audience: { ...sampleBlueprint().audience, size: null } }));

    expect(md.startsWith("# 用 AI 工具把週報時間砍一半\n\n教行政人員用現成 AI 工具處理重複性文書工作\n")).toBe(true);
    expect(section(md, "受眾")).toBe(
      [
        "- 對象：中小企業行政與業務助理",
        "- 人數：未定",
        "- 先備：會用 Word/Excel，沒用過任何 AI 工具",
        "- 痛點：每週花三小時整理週報；不知道 AI 工具能不能信",
      ].join("\n"),
    );
    expect(section(md, "形式")).toBe("- 工作坊・場地：未定");
  });

  it("五元素缺的格寫（缺），其他格照實寫", () => {
    const bp = sampleBlueprint();
    bp.elements.quote = [];

    expect(section(blueprintToMarkdown(bp), "五元素")).toBe(
      [
        "- 理論：AI 工具三分類",
        "- 動手：用自己的週報練一次",
        "- 帶走：週報 prompt 範本",
        "- 金句：（缺）",
        "- 故事：某會計事務所把月結從三天縮到一天",
      ].join("\n"),
    );
  });

  it("每天的時段與單元標題都列出來，單元附上分鐘、模組、層級與沿用程度", () => {
    const md = blueprintToMarkdown(sampleBlueprint());
    const schedule = section(md, "課程安排");

    expect(md).toContain("## 課程安排（共 720 分鐘）");
    expect(schedule).toContain("### 第 1 天：把自己的週報交給 AI");
    expect(schedule).toContain("#### 上午（180 分鐘）");
    expect(schedule).toContain("1. **週報拆解**（60 分鐘・A1 通用生成 AI・L2 產出・沿用）");
    expect(schedule).toContain("2. **第一份草稿**（120 分鐘・A1 通用生成 AI・L2 產出・沿用）");
    expect(schedule).toContain("### 第 2 天：把範本推給整個部門");
    expect(schedule).toContain("#### 下午（180 分鐘）");
    expect(schedule).toContain("1. **維護與治理**（180 分鐘・A1 通用生成 AI・L2 產出・沿用）");
  });

  it("單元的細項：有動手環節就照寫，純講述寫無（純講述），來源寫單元卡", () => {
    const schedule = section(blueprintToMarkdown(sampleBlueprint()), "課程安排");

    expect(schedule).toContain("   - 學習目標：完成「週報拆解」的練習");
    expect(schedule).toContain("   - 動手環節：用自己的資料做一次");
    expect(schedule).toContain("   - 來源：單元卡 uc-weekly-report「週報拆解」");
    expect(schedule).toContain("   - 動手環節：無（純講述）");
  });

  it("承接只在有值時寫；來源是課程與新做的寫法", () => {
    const bp = sampleBlueprint();
    const [first, second] = bp.days[0].slots[0].units;
    second.carriesFrom = first.title;
    first.source = { kind: "course", id: "course-old-1", version: 2, unit: "週報拆解" };
    bp.days[0].slots[1].units[0].source = null;
    bp.days[0].slots[1].units[0].reuse = "new";

    const schedule = section(blueprintToMarkdown(bp), "課程安排");
    expect(schedule).toContain("   - 來源：課程 course-old-1 第 2 版「週報拆解」");
    expect(schedule).toContain("   - 承接：週報拆解");
    expect(schedule).toContain("   - 來源：新做");
    expect(schedule.match(/承接：/g)).toHaveLength(1);
  });

  it("待確認事項依 openItems 列出，標出對象與受影響單元", () => {
    const md = blueprintToMarkdown(
      sampleBlueprint({
        openQuestions: [
          { text: "教室有沒有電腦？", audience: "client", unit: "第一份草稿" },
          { text: "要不要附評分表？", audience: "self", unit: null },
        ],
        tools: [{ name: "Copilot", plan: "enterprise", confirmedWithClient: false }],
      }),
    );

    expect(section(md, "待確認事項")).toBe(
      [
        "- [問客戶] 教室有沒有電腦？（影響第 1 天上午「第一份草稿」）",
        "- [自己決定] 要不要附評分表？",
        "- [問客戶] 學員是否都能使用 Copilot（企業版）？",
      ].join("\n"),
    );
  });

  it("沒有待確認事項時寫（無）", () => {
    expect(section(blueprintToMarkdown(sampleBlueprint()), "待確認事項")).toBe("- （無）");
  });

  it("工具列出方案與是否已跟客戶確認；沒有工具寫（無）", () => {
    const md = blueprintToMarkdown(
      sampleBlueprint({
        tools: [
          { name: "ChatGPT", plan: "free", confirmedWithClient: true },
          { name: "Copilot", plan: "enterprise", confirmedWithClient: false },
        ],
      }),
    );
    expect(section(md, "工具")).toBe("- ChatGPT（免費版）・已確認\n- Copilot（企業版）・未跟客戶確認");

    expect(section(blueprintToMarkdown(sampleBlueprint({ tools: [] })), "工具")).toBe("- （無）");
  });

  it("沒有限制時寫（無）", () => {
    expect(section(blueprintToMarkdown(sampleBlueprint({ constraints: [] })), "限制")).toBe("- （無）");
  });
});
