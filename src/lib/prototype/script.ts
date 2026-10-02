import { BlueprintSchema, type Blueprint } from "@/lib/blueprint/schema";
import {
  modulesForTopic,
  topicLabel,
  type TopicId,
} from "./catalog";

/**
 * UI 雛形（#17）的腳本式對話與藍圖 fixture。完全不呼叫 Anthropic API。
 * 這裡的假回覆只能驗證版面與資訊流，驗證不了真實 AI 的推薦品質。
 */

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

/** 對話開場白；選好主題後由 UI 放進對話框。 */
export function openingMessage(topic: TopicId): ChatMessage {
  return {
    role: "assistant",
    text: `你好，這場課的主題是「${topicLabel(topic)}」。先問最重要的一題：來上課的人是誰？他們離場時要能做到什麼？`,
  };
}

/**
 * 第 turn 次（從 0 起算）講師發話後的 AI 回覆。
 * 腳本講完後固定提示可以更新藍圖。
 */
export function scriptedReply(topic: TopicId, turn: number): ChatMessage {
  const mods = modulesForTopic(topic);
  const label = topicLabel(topic);

  const turns = [
    `了解。我們之前上過幾個「${label}」的相近模組，可以參考：\n${mods
      .map((m) => `・${m.title}（${m.minutes} 分鐘，出自${m.source}）`)
      .join("\n")}\n你想沿用哪幾個？還是想從頭設計？`,
    `好，那這場課要多長？是講座還是動手工作坊？另外，學員目前對${label}的熟悉程度到哪裡？`,
    `我來盤點五元素：理論、動手、帶走、故事都有著落了，但「金句」還是空的。差不多的話可以按「更新藍圖」，我會把目前談的整理出來。`,
  ];

  return {
    role: "assistant",
    text:
      turns[turn] ??
      "目前談的內容已經足夠整理成藍圖，按「更新藍圖」就能看到。",
  };
}

/**
 * 預寫的藍圖：單元取自該主題的模組目錄，並故意讓「金句」留空，
 * 好讓畫面展示五元素缺格。回傳前會通過 BlueprintSchema 驗證。
 */
export function prototypeBlueprint(topic: TopicId): Blueprint {
  const label = topicLabel(topic);
  const mods = modulesForTopic(topic);

  return BlueprintSchema.parse({
    title: `${label} 實戰入門：把重複工作交給自動化`,
    oneLiner: `讓沒有程式背景的上班族，當天就用${label}做出第一個能用的自動化。`,
    audience: {
      who: "中小企業的行政、人資與財務人員",
      size: 20,
      priorKnowledge: "熟悉 Office 與 Google 工具，但從未寫過自動化流程",
      painPoints: ["每週重複整理同樣的報表", "不知道該從哪個工作開始自動化"],
    },
    outcomes: [
      `用${label}完成一個自己工作中的小型自動化`,
      "列出三件值得自動化的事並排出優先順序",
    ],
    format: {
      durationMinutes: mods.reduce((sum, m) => sum + m.minutes, 0),
      mode: "workshop",
      venue: null,
    },
    narrative: {
      model: "SCQA",
      arc: ["情境：每週重複的工作", "衝突：時間被吃掉", "提問：能不能交給機器", "解答：動手做一個"],
    },
    elements: {
      theory: ["觸發、動作、條件三個概念"],
      handsOn: ["現場建立並執行第一個自動化"],
      takeaway: ["三件值得自動化的事清單"],
      quote: [],
      story: ["一個每週吃掉半天的重複工作，如何被自動化取代"],
    },
    modules: mods, // zod 會丟掉多餘的 source 欄位
    constraints: ["學員自備筆電", "需要可登入的帳號"],
    openQuestions: ["課程日期與場地尚未確認", "是否需要提供課後練習檔案"],
  });
}
