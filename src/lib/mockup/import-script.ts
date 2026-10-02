import type { DraftProposal, TopicId } from "./types";

/**
 * 「匯入過往講義」的腳本化結果（#48）。demo 不真的讀檔，
 * 依檔名與講師選的主題，產生一份看起來合理的「新框架」草稿。
 */

export const IMPORT_ACCEPT = ".pdf,.pptx,.docx,.md";

const SCRIPT: Record<TopicId, { summary: (title: string) => string; moduleTitles: string[] }> = {
  claude: {
    summary: (t) => `從講義「${t}」拆出來的 Claude 課程骨架：先看懂 AI 的邊界，再動手寫提示詞，最後留下能帶回工作的做法。`,
    moduleTitles: ["AI 能做什麼、不能做什麼", "提示詞的基本零件", "用自己的文件動手練習", "帶走三個可以馬上用的情境"],
  },
  gas: {
    summary: (t) => `從講義「${t}」拆出來的 Google Apps Script 課程骨架：從試算表的重複工作出發，寫出第一支自動化腳本。`,
    moduleTitles: ["找出試算表裡的重複工作", "Apps Script 編輯器與第一支腳本", "觸發條件與排程", "錯誤處理與交接"],
  },
  "power-automate": {
    summary: (t) => `從講義「${t}」拆出來的 Power Automate 課程骨架：把簽核與通知流程畫出來，再一步步做成雲端流程。`,
    moduleTitles: ["畫出現在的流程", "第一個雲端流程：表單到通知", "條件、核准與例外"],
  },
};

/** 檔名去掉副檔名與前後空白；去完是空的就回傳原檔名 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  const title = (dot > 0 ? base.slice(0, dot) : base).trim();
  return title || base;
}

export function importProposal(fileName: string, topicId: TopicId): Extract<DraftProposal, { kind: "new_framework" }> {
  const title = titleFromFileName(fileName);
  const script = SCRIPT[topicId];
  return {
    kind: "new_framework",
    framework: { topicId, title, summary: script.summary(title), moduleTitles: [...script.moduleTitles] },
  };
}
