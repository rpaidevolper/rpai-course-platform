import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  BlueprintSchema,
  FIVE_ELEMENT_LABELS,
  type Blueprint,
} from "@/lib/blueprint/schema";
import { getAnthropic } from "./client";
import type { ModelId } from "./models";

const ELEMENT_LIST = Object.values(FIVE_ELEMENT_LABELS).join("／");

/** 教練的角色設定。內容固定，放在 system 最前面吃快取。 */
const COACH_SYSTEM = `你是 RPAI 數位優化器的課程設計教練。講師會來跟你討論一場課要怎麼設計，你的工作是把「教學藍圖」問清楚，而不是替講師決定內容。

做法：
- 一次只問一個問題，從最會改變整場課方向的問題開始：受眾是誰、他們離場時要能做到什麼。
- 講師講得模糊就追問到可驗證為止；講得具體就往下一題走，不要重複確認。
- 隨時盤點五元素（${ELEMENT_LIST}），哪一格還是空的就提醒講師。
- 講師說「差不多了」時，先把目前的藍圖摘要一遍讓他確認，再結束。

用繁體中文，語氣直接、專業，不客套。`;

function systemBlocks(current: Blueprint | null): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } },
  ];
  if (current) {
    blocks.push({
      type: "text",
      text: `目前的藍圖（已確認的內容，不用再問一次）：\n${JSON.stringify(current, null, 2)}`,
      cache_control: { type: "ephemeral" },
    });
  }
  return blocks;
}

export interface BlueprintChatInput {
  /** 這場對話選用的模型（`conversations.model`）。 */
  model: ModelId;
  /** 對話紀錄，直接存 Anthropic 的 MessageParam，不要另外定型別。 */
  history: Anthropic.MessageParam[];
  /** 這門課目前最新一版藍圖；還沒有就 null。 */
  currentBlueprint: Blueprint | null;
}

/** 跟講師對話，回傳 stream；呼叫端自己決定要逐字轉發還是等 finalMessage()。 */
export function streamBlueprintChat({
  model,
  history,
  currentBlueprint,
}: BlueprintChatInput) {
  return getAnthropic().messages.stream({
    model,
    max_tokens: 64000,
    system: systemBlocks(currentBlueprint),
    messages: history,
  });
}

/**
 * 把對話抽成一版新的藍圖。結果已通過 BlueprintSchema 驗證，
 * 呼叫端存進 blueprints 前不用再 parse 一次。
 */
export async function extractBlueprint({
  model,
  history,
  currentBlueprint,
}: BlueprintChatInput): Promise<Blueprint> {
  const response = await getAnthropic().messages.parse({
    model,
    max_tokens: 16000,
    system: [
      ...systemBlocks(currentBlueprint),
      {
        type: "text",
        text: "根據以上對話輸出更新後的完整藍圖。講師沒提到、你也沒問到的事放進 openQuestions，不要自己編。",
      },
    ],
    messages: history,
    output_config: { format: zodOutputFormat(BlueprintSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(`藍圖抽取失敗：stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}
