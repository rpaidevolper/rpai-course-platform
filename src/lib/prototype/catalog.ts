import { z } from "zod";
import { ModuleSchema } from "@/lib/blueprint/schema";

/**
 * UI 雛形（#17）用的假資料：各主題的「過往課程模組」目錄。
 * 資料形狀沿用藍圖的 ModuleSchema，再加上出處，之後換成真資料（#8）時 UI 不用改。
 */

export const TOPICS = [
  { id: "claude", label: "Claude" },
  { id: "gas", label: "Google Apps Script" },
  { id: "power-automate", label: "Power Automate" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export const CatalogModuleSchema = ModuleSchema.extend({
  source: z.string().trim().min(1).describe("這個模組出自哪一場過往課程"),
});
export type CatalogModule = z.infer<typeof CatalogModuleSchema>;

const CATALOG: Record<TopicId, CatalogModule[]> = {
  claude: [
    {
      title: "用 Claude 把會議記錄變成待辦清單",
      minutes: 20,
      objective: "寫出能穩定產出待辦事項的提示詞",
      keyPoints: ["角色與輸出格式要寫死", "給一個範例勝過十句說明"],
      activity: "每人拿自己的會議記錄，現場改三次提示詞並比較結果",
      elements: ["theory", "handsOn"],
      source: "2026-03 行政人員 AI 提效工作坊",
    },
    {
      title: "Claude Projects：讓 AI 記得你的工作脈絡",
      minutes: 40,
      objective: "建立一個帶有公司規範與範本的 Project",
      keyPoints: ["Project 知識庫與指示的分工", "哪些資料不該上傳"],
      activity: "建立自己的 Project 並用它回覆一封客戶來信",
      elements: ["theory", "handsOn", "takeaway"],
      source: "2026-05 中小企業主管 AI 入門講座",
    },
    {
      title: "從重複工作找出可交給 AI 的三件事",
      minutes: 30,
      objective: "列出自己工作中最值得自動化的三件事並排出優先順序",
      keyPoints: ["頻率 × 耗時 × 出錯成本", "先做最小的一個"],
      activity: null,
      elements: ["story", "takeaway"],
      source: "2026-05 中小企業主管 AI 入門講座",
    },
  ],
  gas: [
    {
      title: "三分鐘寫出第一支 Apps Script：自動寄信",
      minutes: 20,
      objective: "在試算表中執行一支會寄出通知信的腳本",
      keyPoints: ["Script 編輯器與授權流程", "用 AI 產生再自己讀懂"],
      activity: "複製範例、改成自己的收件人與內容並執行",
      elements: ["theory", "handsOn"],
      source: "2026-02 行政與人資 Google 表單自動化班",
    },
    {
      title: "表單回覆自動整理成報表",
      minutes: 40,
      objective: "建立由表單送出觸發的自動彙整流程",
      keyPoints: ["觸發器的種類", "錯誤通知要設在哪裡"],
      activity: "每人從自己的表單送出一筆資料，確認報表自動更新",
      elements: ["theory", "handsOn", "takeaway"],
      source: "2026-02 行政與人資 Google 表單自動化班",
    },
    {
      title: "那封寄錯五十人的信：自動化的安全網",
      minutes: 30,
      objective: "替自己的腳本加上測試模式與寄送前確認",
      keyPoints: ["先寄給自己", "用日誌留下每次執行紀錄"],
      activity: null,
      elements: ["story", "theory"],
      source: "2026-07 企業內訓：總務流程自動化",
    },
  ],
  "power-automate": [
    {
      title: "Power Automate 雲端流程五分鐘上手",
      minutes: 20,
      objective: "建立一個收到郵件就存附件到 OneDrive 的流程",
      keyPoints: ["觸發、動作、條件三個概念", "雲端流程與桌面流程的差別"],
      activity: "照步驟建立流程並寄測試信驗證",
      elements: ["theory", "handsOn"],
      source: "2026-01 財務部 Microsoft 365 自動化工作坊",
    },
    {
      title: "簽核流程：讓主管用 Teams 一鍵核准",
      minutes: 40,
      objective: "建立含核准與退回分支的簽核流程",
      keyPoints: ["Approvals 動作的設定", "退回時要帶原因"],
      activity: "兩人一組，一人送出申請、一人在 Teams 核准",
      elements: ["theory", "handsOn", "takeaway"],
      source: "2026-04 企業內訓：請款流程數位化",
    },
    {
      title: "從紙本表單到流程：一個請假單的改造",
      minutes: 30,
      objective: "把一個現有紙本流程拆成可自動化的步驟",
      keyPoints: ["先畫現況流程", "找出等待與重複輸入"],
      activity: null,
      elements: ["story", "takeaway"],
      source: "2026-04 企業內訓：請款流程數位化",
    },
  ],
};

/** 某個主題下可推薦的過往模組。 */
export function modulesForTopic(topic: TopicId): CatalogModule[] {
  return CATALOG[topic];
}

export function topicLabel(topic: TopicId): string {
  return TOPICS.find((t) => t.id === topic)!.label;
}
