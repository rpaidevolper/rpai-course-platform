import type { DraftProposal, ModuleId, UnitCard } from "./types";

/**
 * 「匯入過往講義」的腳本化結果（#48、#55）。demo 不真的讀檔，
 * 依檔名與講師選的模組，產生一份看起來合理的草稿：AI 會把講義拆成單元卡與一份課程配方。
 */

export const IMPORT_ACCEPT = ".pdf,.pptx,.docx,.md";

/** 每個模組示範用的單元卡標題，各 2–3 張。 */
const SCRIPT: Record<ModuleId, string[]> = {
  A1: ["打開對話框，先把一份文件交給 AI", "用角色與格式把回答收斂", "把常用脈絡存進 Project"],
  A2: ["把手冊切段後上傳", "設定只根據文件回答"],
  A3: ["錄製第一段桌面操作", "批次開啟與整併檔案"],
  A4: ["第一個雲端流程：表單到通知", "加上核准與退回", "逾期與例外的處理"],
  A5: ["把重複步驟寫成 Skill", "用一段說明請 AI 寫出小程式"],
  B1: ["畫出現在的工作流程", "找出重複與等待"],
  B2: ["提示詞的基本零件", "把審核規則寫成指令"],
  B3: ["上傳前的資料分級", "上線前的檢查與負責人"],
  B4: ["算出每月的使用成本", "比較自動化省下的時間"],
};

/** 檔名去掉副檔名與前後空白；去完是空的就回傳原檔名 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  const title = (dot > 0 ? base.slice(0, dot) : base).trim();
  return title || base;
}

/** 匯入的單元卡只有標題是腳本給的，目標、方法與成果用通用文字。 */
const unitCardOf = (id: string, moduleId: ModuleId, title: string): UnitCard => ({
  id,
  moduleId,
  title,
  minutes: 60,
  level: null,
  objective: `練習「${title}」的做法`,
  method: "講述＋動手練習",
  outcome: "一份可以帶回工作的成果",
  audiences: [],
  tools: [],
  scenarios: [],
});

/**
 * 依檔名與講師選的模組，產生一份課程配方草稿加上每個單元一份新單元卡草稿
 * （沒有來源課程、沒有日期，對象、工具與應用場景待確認）。單元卡 id 是 `${baseId}-u1`…，配方 id 是 baseId。
 */
export function importProposals(fileName: string, moduleId: ModuleId, baseId: string): DraftProposal[] {
  const unitCards = SCRIPT[moduleId].map((title, i) => unitCardOf(`${baseId}-u${i + 1}`, moduleId, title));
  return [
    {
      kind: "new_course_recipe",
      recipe: {
        id: baseId,
        title: titleFromFileName(fileName),
        status: "delivered",
        heldOn: null,
        audiences: [],
        tools: [],
        industries: ["通用"],
        scenarios: [],
      },
      unitCardIds: unitCards.map((u) => u.id),
    },
    ...unitCards.map((unitCard): DraftProposal => ({ kind: "new_unit_card", unitCard })),
  ];
}
